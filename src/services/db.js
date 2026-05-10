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
