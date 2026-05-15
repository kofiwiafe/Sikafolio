import Dexie from 'dexie'

export const db = new Dexie('SikaFolio')

db.version(1).stores({
  trades: '++id, emailId, symbol, orderType, quantity, grossConsideration, processingFee, netConsideration, pricePerShare, settlementDate, executionDate, status',
  prices: 'symbol, price, change, changePercent, updatedAt',
  syncMeta: 'key, value'
})

db.version(2).stores({
  trades: '++id, emailId, symbol, orderType, quantity, grossConsideration, processingFee, netConsideration, pricePerShare, settlementDate, executionDate, status',
  prices: 'symbol, price, change, changePercent, updatedAt',
  syncMeta: 'key, value',
  users: '++id, &email, name, passcode, avatar, provider'
})

// version 3: daily price snapshots for portfolio value chart
db.version(3).stores({
  trades: '++id, emailId, symbol, orderType, quantity, grossConsideration, processingFee, netConsideration, pricePerShare, settlementDate, executionDate, status',
  prices: 'symbol, price, change, changePercent, updatedAt',
  syncMeta: 'key, value',
  users: '++id, &email, name, passcode, avatar, provider',
  priceSnapshots: 'date', // PK = 'YYYY-MM-DD', upserted daily
})

// version 4: orderNumber index for screenshot import dedup
db.version(4).stores({
  trades: '++id, emailId, orderNumber, symbol, orderType, quantity, grossConsideration, processingFee, netConsideration, pricePerShare, settlementDate, executionDate, status',
  prices: 'symbol, price, change, changePercent, updatedAt',
  syncMeta: 'key, value',
  users: '++id, &email, name, passcode, avatar, provider',
  priceSnapshots: 'date',
})

// version 5: tradeId index for contract note import dedup
db.version(5).stores({
  trades: '++id, emailId, orderNumber, tradeId, symbol, orderType, quantity, grossConsideration, processingFee, netConsideration, pricePerShare, settlementDate, executionDate, status',
  prices: 'symbol, price, change, changePercent, updatedAt',
  syncMeta: 'key, value',
  users: '++id, &email, name, passcode, avatar, provider',
  priceSnapshots: 'date',
})
