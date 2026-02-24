-- Schema
CREATE TABLE Customer (
  CustomerId INTEGER PRIMARY KEY,
  CustomerName TEXT NOT NULL,
  Country TEXT NOT NULL,
  Segment TEXT NOT NULL
);

CREATE TABLE SalesOrder (
  SalesOrderId INTEGER PRIMARY KEY,
  CustomerId INTEGER NOT NULL,
  OrderDate TEXT NOT NULL,
  NetAmount REAL NOT NULL,
  Currency TEXT NOT NULL,
  FOREIGN KEY (CustomerId) REFERENCES Customer(CustomerId)
);

-- Sample queries
SELECT c.CustomerName, SUM(so.NetAmount) AS TotalAmount
FROM Customer c
JOIN SalesOrder so ON so.CustomerId = c.CustomerId
GROUP BY c.CustomerName
ORDER BY TotalAmount DESC;

SELECT c.Country, COUNT(*) AS Orders, SUM(so.NetAmount) AS TotalAmount
FROM Customer c
JOIN SalesOrder so ON so.CustomerId = c.CustomerId
GROUP BY c.Country
ORDER BY TotalAmount DESC;
