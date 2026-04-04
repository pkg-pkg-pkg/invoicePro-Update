# Phase 3 Masters – ER Diagrams

This document captures the approved baseline schema for Phase 3 (Masters). All services and UI work must stay aligned with these relationships.

## Ledger & Group Model

```mermaid
erDiagram
    LedgerGroup {
        string id
        string name
        string code
        string type
        string parentGroupId
        boolean isSystem
        number sortOrder
        string createdAt
        string updatedAt
    }
    LedgerAccount {
        string id
        string name
        string code
        string groupId
        number openingBalance
        string openingBalanceType
        number currentBalance
        json gstDetails
        json contactDetails
        boolean isCashBank
        boolean isActive
        string createdAt
        string updatedAt
    }
    LedgerTransaction {
        string id
        string ledgerId
        string voucherType
        string voucherId
        string date
        number debit
        number credit
        number runningBalance
        json meta
        string createdAt
    }

    LedgerGroup ||--o{ LedgerGroup : parent
    LedgerGroup ||--o{ LedgerAccount : contains
    LedgerAccount ||--o{ LedgerTransaction : posts
```

## Inventory Masters

```mermaid
erDiagram
    ItemCategory {
        string id
        string name
        string code
        string parentId
        boolean isActive
        string createdAt
        string updatedAt
    }
    UnitOfMeasure {
        string id
        string name
        string symbol
        string uqc
        number precision
        string createdAt
        string updatedAt
    }
    Godown {
        string id
        string name
        string code
        string address
        boolean isDefault
        boolean isActive
        string createdAt
        string updatedAt
    }
    InventoryItem {
        string id
        string name
        string sku
        string barcode
        string categoryId
        string unitId
        string secondaryUnitId
        number conversionRatio
        number gstRate
        string hsnCode
        json pricing
        boolean trackBatch
        boolean trackSerial
        boolean trackExpiry
        number openingStock
        number openingValue
        number currentStock
        number reorderLevel
        json godownStocks
        string status
        string createdAt
        string updatedAt
    }
    StockAdjustment {
        string id
        string itemId
        string godownId
        string type
        number quantity
        number value
        string reason
        string date
        string createdAt
    }

    ItemCategory ||--o{ ItemCategory : parent
    ItemCategory ||--o{ InventoryItem : categorizes
    UnitOfMeasure ||--o{ InventoryItem : primaryUnit
    UnitOfMeasure ||--o{ InventoryItem : secondaryUnit
    Godown ||--o{ InventoryItem : stockedIn
    InventoryItem ||--o{ StockAdjustment : adjusts
```
