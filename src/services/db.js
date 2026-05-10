import Dexie from 'dexie'

export const db = new Dexie('SikaFolio')

db.version(1).stores({
  // All parsed trades from Gmail
  trades: '++id, emailId, symbol, orderType, quantity, grossConsideration, processingFee, netConsideration, pricePerShare, settlementDate, executionDate, status',

  // Latest price per symbol
  prices: 'symbol, price, change, changePercent, updatedAt',

  // Sync metadata — track last email scan date
  syncMeta: 'key, value'
})
