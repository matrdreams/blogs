---
title: "RocketMQ 存储结构解析"
description: "梳理 RocketMQ Broker 的 CommitLog、ConsumeQueue 与 Index File，以及刷盘、索引和查询机制。"
publishedAt: 2022-08-04
category: "技术现场"
tags: ["RocketMQ","消息队列","存储"]
readingMinutes: 10
draft: false
---
## 概述

对于一个数据存储中间件来说，数据在磁盘的存储机制直接决定着程序的性能、可靠性和可用性等关键指标，所以了解 RocketMQ 的存储机制对深入理解 RocketMQ 至关重要。

RocketMQ 存储主要是由 Broker 来完成的，本文主要从以下几个方面来介绍 Broker 的数据存储机制。

* 数据目录结构
* 数据存储
* 索引存储

## 数据目录结构

* **commitlog：**这个目录下包含具体的数据文件，不区分 topic 以及 queueId，也就是说此 broker 收到的所有消息都会存储在这个目录下。每个文件的文件名由该文件中保存消息的最小物理 offset 在高位补0组成，文件默认大小为1G。
* **consumequeue：**这是一个索引目录，文件结构为 consumequeue/该broker下所有Topic名称/该Topic下所有队列名/具体的消费队列文件。每个消费队列文件的每条数据其实是commitlog文件的一个索引，包含三个信息：对应消息在 commitlog 文件中的 offset、消息 Tag 的 hashcode、消息长度。
* **index：**这是一个索引目录，目录下的每个文件其实是按照消息Key构建的存储在磁盘中的HashMap。用来加速按照消息 key 检索消息的场景。
* **config：**此目录下保存了当前 broker 中的全部 Topic、订阅关系和消费进度。
* **abort：**此文件保存 Broker 异常关闭的标志。如果 Broker 是正常关闭的，则此文件会被删除。当 Broke 启动时，会根据是否异常关闭来决定是否需要重新构建 Index 索引等操作。
* **checkpoint：**此文件保存 Broker 最近一次正常运行时的状态，如刷盘时间、构建索引时间等。

Broker 数据目录结构示意图：

```
store
├── abort
├── checkpoint 
├── lock 
├── commitlog
│   ├── {{数据文件}}
├── config
│   ├── {{配置文件}}
├── consumequeue
│   ├── {{Topic名}}
│   │   └── {{分区编号}}
│   │       └── {{索引文件}}
├── index
│   ├── {{索引文件}}
```

## 数据存储

RocketMQ 中的接收到的所有消息 (不区分 Topic 和队列) 及对应的元数据都存储在 Broker 的 commitlog 目录下。

每个文件大小为1G（可配置），消息顺序写入最新的文件，当文件被写满会创建一个新的文件。文件名长度为20个字符，由该文件存储消息的最小偏移量左边补0组成。

### 消息结构

commitlog 中存储的每条消息结构如下表所示：

| 字段                       | 说明                          | 字节  |
| ------------------------ | --------------------------- | --- |
| MsgLen                   | 消息总长度                       | 4   |
| MagicCode                | 魔数，标识是消息还是结束符               | 4   |
| BodyCRC                  | 消息内容CRC                     | 4   |
| QueueId                  | 分区ID                        | 4   |
| QueueOffset              | 消息所在分区的偏移量                  | 8   |
| PhysicalOffset           | 消息所在commitlog文件的位置          | 8   |
| SysFlag                  | 标志，按位或。存储如消息版本、事物状态、是否压缩等信息 | 4   |
| BornTimestamp            | 发送消息时间                      | 8   |
| BornHost                 | 发送主机                        | 8   |
| StoreTimestamp           | 消息存储时间                      | 8   |
| StoreHost                | 消除主机                        | 8   |
| ReconsumeTimes           | 重试消息次数                      | 4   |
| PreparedTransationOffset | 事务消息位点                      | 8   |
| BodyLength               | 消息体长度                       | 4   |
| Body                     | 消息体                         | 不定长 |
| TopicLength              | Topic长度                     | 1   |
| Topic                    | Topic                       | 不定长 |
| PropertiesLength         | 扩展信息长度                      | 2   |
| Properties               | 扩展信息，如消息Tag、Key等            | 不定长 |

### 消息刷盘机制

RocketMQ支持两种刷盘机制，即同步刷盘和异步刷盘。

在Broker启动时配置 flushDiskType = SYNC\__FLUSH 表示同步刷盘，配置_ flushDiskType _=_ ASYNC\_FLUSH 表示异步刷盘。

### IO优化

Broker 中的消息在写入commitlog的时候会使用顺序写、零拷贝（mmap实现）两个优化。所以  RocketMQ 的写入性能很高。

> **补充**
>
> Kafka的消息是根据不同Topic下的不同分区单独写入，每个分区都是一系列单独的文件。所以Kafka在单个Broker中存储了太多的分区时会导致写入数据退化为近似随机IO，从而影响Broker的吞吐量。
>
> RocketMQ由于单台Broker所有的消息均写入同一个文件，所以RocketMQ的设计机制使得不管Broker上有多少分区，写入磁盘时始终是顺序IO，避免了分区过多导致的写性能下降。

## 索引存储

从前面数据存储的部分我们了解到，RocketMQ中不同Topic、不同分区的消息都是混合在相同文件中的。这种设计会导致在没有索引的情况下消费消息时需要遍历整个文件来查找数据。对于 RocketMQ 这样的高性能中间件来说是必然不能接受的，所以就需要设计合理的索引机制来保证高效的查询数据。

RocketMQ中有两种索引文件，分别是 Consumer Queue 和 Index File

### Consumer Queue

主要用于消费者拉取消息、更新消费位点等。

此目录的相对路径为 Topic -> QueueId，每个 Topic 下的每个队列都对应多个 consume queue 文件，每个文件默认存储30W条索引 (可配置)，每条索引信息顺序写入文件，，写满当前文件后创建一个新的文件。文件内保存了消息在 commitlog 中的物理位点、消息体大小、消息Tag的Hash值。

每条索引信息结构如下图所示：

```
--------------------------------------------------
|    物理位点    |  消息体大小  |    Tag的Hash值    |
--------------------------------------------------
```

* **物理位点：**占用8字节，消息在CommitLog文件中的物理偏移量
* **消息体大小：**占用4字节，消息数据总大小，单位为字节
* **Tag的Hash值：**占用8字节，消息Tag的Hash值

### Index File

存储在 index 目录下，Index File本质上是存储在磁盘中的一个 Hash 索引，解决 Hash 冲突的方式为链表法。文件分为三部分，分别是index header、slot table、index data。文件大致结构如下：

```
---------------------------------------
|  header信息  |  hash槽  |  索引数据  |
---------------------------------------
```

#### Index header

此部分存储当前索引文件的一些属性信息

* **beginTimestamp、endTimestamp：**该索引文件中第一条消息和最后一条消息在 commitlog 中存储的时间，也就是消息在 Broker 中的实际落盘时间。
* **beginPhyoffset、endPhyoffset：**该索引文件中第一条消息和最后一条消息在 commitlog 中的物理偏移量。
* **hashSlotCount：**该索引文件中的 hash slot 的个数。
* **indexCount：**该索引文件中的索引数据条数。

#### Slot Table

Index File本质上是存储在磁盘中的一个 Hash 索引。这部分位置就是 Hash 索引中的槽位 (slot)  ，每个占用4字节，默认500万个 (可配置)。

每个 slot 中存储对应的索引数据偏移量，如果存在 hash 冲突，则存储的是**最新的**一个索引数据 (因为大多数情况下我们总是关心最近存储的数据)。

#### Index Data 结构

此部分为真正的索引数据，每个索引项存储如下信息：

* **消息 Key 的 Hash 值：**占用4字节，key = topic + “#” + KEY ，然后计算 hash
* **消息位点：**占用8字节，消息在 commitlog 中的物理偏移量
* **时间差：**4字节，当前索引对应消息的存储时间与 Index header 部分 beginTimestamp 属性的差值，单位为秒。存储差值应该是为了节省空间。
* **下一节点偏移量：**占用4字节，因为可能存在 Hash 冲突，所以每个索引项都需要存储下一节点的位置。

### 索引使用方式

#### 按照消费位点查询消息

1. 根据 topic、queueId 找到对应的 consumer queue 目录
2. 因为消息按照顺序写入，所以可以根据 offset 确定对应的索引文件
3. 循环获取 consume queue 中的消息，先根据消息的 tag hash 过滤，如果符合条件，再根据 offset 和消息大小去 commitlog 获取数据。

#### 按时间段查询消息

1. 查找这个 Topic 的所有 Queue
2. 在每一个队列中查找起始时间、结束时间对应的起始 offset 和最后消息的 offset。
3. 根据起始位点、最后消息位点和 Topic，循环拉取所有 Queue 就可以获取到消息了。

> **补充**
>
> Consume Queue 索引文件是按照消息的存储时间顺序写入的，且每条索引信息的大小固定为20字节。所以可以根据时间做二分搜索，找到与时间最接近的一个位点。
>
> Consume Queue 索引文件中并没有存储消息存储时间，所以做二分搜索时需要去 commitlog 文件中查找消息的存储时间。

#### 按消息 Key 查询消息

需使用 Index File 索引文件，因为该文件存储了一个 hash 索引，所以根据 Topic 和 key 计算 hash，找到消息的物理位点信息，再去 commitlog 文件中查找消息内容即可。

### 索引可靠性

Consumer Queue 和 Index File 文件在每次刷盘时都会做 Checkpoint 操作，Broker 每次重启时可以根据 Checkpoint 信息得知哪些消息还未创建索引，从而保证索引的可靠性。
