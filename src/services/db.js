import Dexie from 'dexie'

// Local IndexedDB — only used for price cache and price snapshots.
// Users, trades, and syncMeta now live in Neon (cloud DB) for cross-device sync.
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

db.version(3).stores({
  trades: '++id, emailId, symbol, orderType, quantity, grossConsideration, processingFee, netConsideration, pricePerShare, settlementDate, executionDate, status',
  prices: 'symbol, price, change, changePercent, updatedAt',
  syncMeta: 'key, value',
  users: '++id, &email, name, passcode, avatar, provider',
  priceSnapshots: 'date',
})

db.version(4).stores({
  trades: '++id, emailId, orderNumber, symbol, orderType, quantity, grossConsideration, processingFee, netConsideration, pricePerShare, settlementDate, executionDate, status',
  prices: 'symbol, price, change, changePercent, updatedAt',
  syncMeta: 'key, value',
  users: '++id, &email, name, passcode, avatar, provider',
  priceSnapshots: 'date',
})

db.version(5).stores({
  trades: '++id, emailId, orderNumber, tradeId, symbol, orderType, quantity, grossConsideration, processingFee, netConsideration, pricePerShare, settlementDate, executionDate, status',
  prices: 'symbol, price, change, changePercent, updatedAt',
  syncMeta: 'key, value',
  users: '++id, &email, name, passcode, avatar, provider',
  priceSnapshots: 'date',
})

// Version 6: drop local trades, users, syncMeta — data now lives in Neon
db.version(6).stores({
  trades:         null,
  syncMeta:       null,
  users:          null,
  prices:         'symbol, price, change, changePercent, updatedAt',
  priceSnapshots: 'date',
})
