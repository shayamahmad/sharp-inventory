/** Mirrors frontend mockData + InventoryContext defaults + manufacturingData */

export const seedUsers = [
  { id: '1', name: 'Sneha Khatry', email: 'admin@inveto.com', password: 'admin123', role: 'admin' },
  { id: '2', name: 'Priya Sharma', email: 'staff@inveto.com', password: 'staff123', role: 'staff' },
  { id: '3', name: 'Amit Patel', email: 'viewer@inveto.com', password: 'viewer123', role: 'viewer' },
];

export const seedProducts = [
  { id: 'P001', name: 'Wireless Earbuds Pro', category: 'Electronics', price: 2499, cost: 1200, stock: 145, minStock: 30, unit: 'pcs', supplier: 'TechWorld Pvt Ltd', lastRestocked: '2026-03-20', salesLast30: 89 },
  { id: 'P002', name: 'Cotton T-Shirt Premium', category: 'Clothing', price: 799, cost: 350, stock: 8, minStock: 50, unit: 'pcs', supplier: 'FashionHub India', lastRestocked: '2026-03-10', salesLast30: 156 },
  { id: 'P003', name: 'Organic Green Tea', category: 'Food & Beverages', price: 349, cost: 150, stock: 230, minStock: 40, unit: 'boxes', supplier: 'NatureFresh Foods', lastRestocked: '2026-03-18', salesLast30: 67 },
  { id: 'P004', name: 'Smart LED Bulb', category: 'Home & Garden', price: 599, cost: 250, stock: 3, minStock: 20, unit: 'pcs', supplier: 'BrightLite Corp', lastRestocked: '2026-02-28', salesLast30: 45 },
  { id: 'P005', name: 'Yoga Mat Premium', category: 'Sports', price: 1299, cost: 600, stock: 72, minStock: 15, unit: 'pcs', supplier: 'FitLife Sports', lastRestocked: '2026-03-15', salesLast30: 34 },
  { id: 'P006', name: 'Face Serum Vitamin C', category: 'Beauty', price: 899, cost: 320, stock: 15, minStock: 25, unit: 'bottles', supplier: 'GlowSkin Labs', lastRestocked: '2026-03-05', salesLast30: 98 },
  { id: 'P007', name: 'Building Blocks Set', category: 'Toys', price: 1499, cost: 700, stock: 0, minStock: 10, unit: 'sets', supplier: 'PlayZone India', lastRestocked: '2026-01-15', salesLast30: 2 },
  { id: 'P008', name: 'Programming with Python', category: 'Books', price: 599, cost: 200, stock: 180, minStock: 20, unit: 'copies', supplier: 'BookWorld Publishers', lastRestocked: '2026-03-22', salesLast30: 12 },
  { id: 'P009', name: 'Bluetooth Speaker', category: 'Electronics', price: 1899, cost: 900, stock: 55, minStock: 20, unit: 'pcs', supplier: 'TechWorld Pvt Ltd', lastRestocked: '2026-03-19', salesLast30: 72 },
  { id: 'P010', name: 'Running Shoes', category: 'Sports', price: 3499, cost: 1800, stock: 22, minStock: 15, unit: 'pairs', supplier: 'FitLife Sports', lastRestocked: '2026-03-12', salesLast30: 41 },
  { id: 'P011', name: 'Herbal Shampoo', category: 'Beauty', price: 449, cost: 180, stock: 95, minStock: 30, unit: 'bottles', supplier: 'GlowSkin Labs', lastRestocked: '2026-03-17', salesLast30: 55 },
  { id: 'P012', name: 'Masala Chai Pack', category: 'Food & Beverages', price: 199, cost: 80, stock: 320, minStock: 50, unit: 'packs', supplier: 'NatureFresh Foods', lastRestocked: '2026-03-21', salesLast30: 189 },
  { id: 'P013', name: 'USB-C Hub 7-in-1', category: 'Electronics', price: 1799, cost: 850, stock: 38, minStock: 15, unit: 'pcs', supplier: 'TechWorld Pvt Ltd', lastRestocked: '2026-03-14', salesLast30: 28 },
  { id: 'P014', name: 'Denim Jacket Classic', category: 'Clothing', price: 2999, cost: 1400, stock: 12, minStock: 10, unit: 'pcs', supplier: 'FashionHub India', lastRestocked: '2026-03-08', salesLast30: 18 },
  { id: 'P015', name: 'Indoor Plant Pot', category: 'Home & Garden', price: 699, cost: 300, stock: 0, minStock: 15, unit: 'pcs', supplier: 'GreenHome Supplies', lastRestocked: '2026-02-10', salesLast30: 1 },
  { id: 'P016', name: 'Vintage Wall Clock', category: 'Home & Garden', price: 1899, cost: 900, stock: 42, minStock: 10, unit: 'pcs', supplier: 'GreenHome Supplies', lastRestocked: '2025-12-15', salesLast30: 1 },
  { id: 'P017', name: 'Knitting Yarn Bundle', category: 'Toys', price: 399, cost: 150, stock: 85, minStock: 20, unit: 'packs', supplier: 'PlayZone India', lastRestocked: '2025-11-20', salesLast30: 2 },
  { id: 'P018', name: 'Calligraphy Pen Set', category: 'Books', price: 749, cost: 350, stock: 60, minStock: 10, unit: 'sets', supplier: 'BookWorld Publishers', lastRestocked: '2026-01-05', salesLast30: 0 },
];

export const seedOrders = [
  { id: 'ORD001', customerName: 'Vikram Singh', items: [{ productId: 'P001', productName: 'Wireless Earbuds Pro', quantity: 2, price: 2499 }], total: 4998, status: 'Delivered', date: '2026-03-24', createdBy: 'Sneha Khatry' },
  { id: 'ORD002', customerName: 'Neha Gupta', items: [{ productId: 'P002', productName: 'Cotton T-Shirt Premium', quantity: 5, price: 799 }, { productId: 'P006', productName: 'Face Serum Vitamin C', quantity: 1, price: 899 }], total: 4894, status: 'Processing', date: '2026-03-25', createdBy: 'Priya Sharma' },
  { id: 'ORD003', customerName: 'Arjun Mehta', items: [{ productId: 'P009', productName: 'Bluetooth Speaker', quantity: 1, price: 1899 }], total: 1899, status: 'Shipped', date: '2026-03-24', createdBy: 'Sneha Khatry' },
  { id: 'ORD004', customerName: 'Divya Rao', items: [{ productId: 'P012', productName: 'Masala Chai Pack', quantity: 10, price: 199 }], total: 1990, status: 'Placed', date: '2026-03-25', createdBy: 'Priya Sharma' },
  { id: 'ORD005', customerName: 'Suresh Nair', items: [{ productId: 'P005', productName: 'Yoga Mat Premium', quantity: 2, price: 1299 }, { productId: 'P010', productName: 'Running Shoes', quantity: 1, price: 3499 }], total: 6097, status: 'Delivered', date: '2026-03-22', createdBy: 'Sneha Khatry' },
  { id: 'ORD006', customerName: 'Kavitha Reddy', items: [{ productId: 'P003', productName: 'Organic Green Tea', quantity: 3, price: 349 }], total: 1047, status: 'Delivered', date: '2026-03-20', createdBy: 'Priya Sharma' },
  { id: 'ORD007', customerName: 'Ravi Kumar', items: [{ productId: 'P001', productName: 'Wireless Earbuds Pro', quantity: 3, price: 2499 }, { productId: 'P013', productName: 'USB-C Hub 7-in-1', quantity: 2, price: 1799 }], total: 11095, status: 'Delivered', date: '2026-03-18', createdBy: 'Sneha Khatry' },
  { id: 'ORD008', customerName: 'Anjali Verma', items: [{ productId: 'P011', productName: 'Herbal Shampoo', quantity: 4, price: 449 }, { productId: 'P006', productName: 'Face Serum Vitamin C', quantity: 2, price: 899 }], total: 3594, status: 'Shipped', date: '2026-03-23', createdBy: 'Priya Sharma' },
  { id: 'ORD009', customerName: 'Manoj Tiwari', items: [{ productId: 'P010', productName: 'Running Shoes', quantity: 2, price: 3499 }], total: 6998, status: 'Delivered', date: '2026-03-19', createdBy: 'Sneha Khatry' },
  { id: 'ORD010', customerName: 'Pooja Deshmukh', items: [{ productId: 'P014', productName: 'Denim Jacket Classic', quantity: 1, price: 2999 }, { productId: 'P002', productName: 'Cotton T-Shirt Premium', quantity: 3, price: 799 }], total: 5396, status: 'Processing', date: '2026-03-25', createdBy: 'Priya Sharma' },
  { id: 'ORD011', customerName: 'Sanjay Joshi', items: [{ productId: 'P009', productName: 'Bluetooth Speaker', quantity: 2, price: 1899 }], total: 3798, status: 'Placed', date: '2026-03-26', createdBy: 'Sneha Khatry' },
  { id: 'ORD012', customerName: 'Lakshmi Iyer', items: [{ productId: 'P012', productName: 'Masala Chai Pack', quantity: 20, price: 199 }, { productId: 'P003', productName: 'Organic Green Tea', quantity: 5, price: 349 }], total: 5725, status: 'Delivered', date: '2026-03-17', createdBy: 'Priya Sharma' },
  { id: 'ORD013', customerName: 'Deepak Chauhan', items: [{ productId: 'P004', productName: 'Smart LED Bulb', quantity: 5, price: 599 }], total: 2995, status: 'Cancelled', date: '2026-03-21', createdBy: 'Sneha Khatry' },
  { id: 'ORD014', customerName: 'Meera Pillai', items: [{ productId: 'P005', productName: 'Yoga Mat Premium', quantity: 1, price: 1299 }, { productId: 'P011', productName: 'Herbal Shampoo', quantity: 2, price: 449 }], total: 2197, status: 'Shipped', date: '2026-03-23', createdBy: 'Priya Sharma' },
  { id: 'ORD015', customerName: 'Aditya Saxena', items: [{ productId: 'P001', productName: 'Wireless Earbuds Pro', quantity: 1, price: 2499 }], total: 2499, status: 'Delivered', date: '2026-03-16', createdBy: 'Sneha Khatry' },
  { id: 'ORD016', customerName: 'Tanvi Bhatt', items: [{ productId: 'P006', productName: 'Face Serum Vitamin C', quantity: 3, price: 899 }, { productId: 'P011', productName: 'Herbal Shampoo', quantity: 1, price: 449 }], total: 3146, status: 'Processing', date: '2026-03-26', createdBy: 'Priya Sharma' },
  { id: 'ORD017', customerName: 'Harsh Pandey', items: [{ productId: 'P013', productName: 'USB-C Hub 7-in-1', quantity: 1, price: 1799 }, { productId: 'P009', productName: 'Bluetooth Speaker', quantity: 1, price: 1899 }], total: 3698, status: 'Placed', date: '2026-03-26', createdBy: 'Sneha Khatry' },
  { id: 'ORD018', customerName: 'Ritika Malhotra', items: [{ productId: 'P002', productName: 'Cotton T-Shirt Premium', quantity: 10, price: 799 }], total: 7990, status: 'Shipped', date: '2026-03-22', createdBy: 'Priya Sharma' },
  { id: 'ORD019', customerName: 'Gaurav Sinha', items: [{ productId: 'P008', productName: 'Programming with Python', quantity: 2, price: 599 }, { productId: 'P012', productName: 'Masala Chai Pack', quantity: 5, price: 199 }], total: 2193, status: 'Delivered', date: '2026-03-15', createdBy: 'Sneha Khatry' },
  { id: 'ORD020', customerName: 'Shreya Kapoor', items: [{ productId: 'P014', productName: 'Denim Jacket Classic', quantity: 2, price: 2999 }, { productId: 'P010', productName: 'Running Shoes', quantity: 1, price: 3499 }], total: 9497, status: 'Placed', date: '2026-03-26', createdBy: 'Priya Sharma' },
  { id: 'ORD021', customerName: 'Vivek Agarwal', items: [{ productId: 'P005', productName: 'Yoga Mat Premium', quantity: 3, price: 1299 }], total: 3897, status: 'Delivered', date: '2026-03-14', createdBy: 'Sneha Khatry' },
];

export const seedActivityLogs = [
  { id: 'A1', userId: '1', userName: 'Sneha Khatry', action: 'Created Order', details: 'Order ORD001 for Vikram Singh', timestamp: '2026-03-24 14:30' },
  { id: 'A2', userId: '2', userName: 'Priya Sharma', action: 'Added Product', details: 'Added 50 units of Masala Chai Pack', timestamp: '2026-03-24 11:15' },
  { id: 'A3', userId: '1', userName: 'Sneha Khatry', action: 'Updated Stock', details: 'Restocked Wireless Earbuds Pro (+100 units)', timestamp: '2026-03-23 16:45' },
  { id: 'A4', userId: '2', userName: 'Priya Sharma', action: 'Created Order', details: 'Order ORD002 for Neha Gupta', timestamp: '2026-03-25 09:20' },
  { id: 'A5', userId: '1', userName: 'Sneha Khatry', action: 'Deleted Product', details: 'Removed discontinued item: Old Model Charger', timestamp: '2026-03-22 10:00' },
  { id: 'A6', userId: '3', userName: 'Amit Patel', action: 'Viewed Report', details: 'Accessed monthly sales report', timestamp: '2026-03-25 08:00' },
];

export const seedPurchaseOrders = [
  { id: 'PO001', supplier: 'TechWorld Pvt Ltd', productId: 'P001', productName: 'Wireless Earbuds Pro', quantityOrdered: 200, quantityReceived: 200, expectedDelivery: '2026-03-20', status: 'Closed', dateSent: '2026-03-10', dateReceived: '2026-03-20', discrepancy: false },
  { id: 'PO002', supplier: 'FashionHub India', productId: 'P002', productName: 'Cotton T-Shirt Premium', quantityOrdered: 300, quantityReceived: 280, expectedDelivery: '2026-03-15', status: 'Closed', dateSent: '2026-03-05', dateReceived: '2026-03-14', discrepancy: true },
  { id: 'PO003', supplier: 'NatureFresh Foods', productId: 'P003', productName: 'Organic Green Tea', quantityOrdered: 150, quantityReceived: null, expectedDelivery: '2026-03-30', status: 'In Transit', dateSent: '2026-03-20', discrepancy: false },
  { id: 'PO004', supplier: 'BrightLite Corp', productId: 'P004', productName: 'Smart LED Bulb', quantityOrdered: 100, quantityReceived: null, expectedDelivery: '2026-04-01', status: 'Sent', dateSent: '2026-03-22', discrepancy: false },
  { id: 'PO005', supplier: 'GlowSkin Labs', productId: 'P006', productName: 'Face Serum Vitamin C', quantityOrdered: 200, quantityReceived: 160, expectedDelivery: '2026-03-18', status: 'Closed', dateSent: '2026-03-08', dateReceived: '2026-03-17', discrepancy: true },
  { id: 'PO006', supplier: 'FitLife Sports', productId: 'P005', productName: 'Yoga Mat Premium', quantityOrdered: 50, quantityReceived: null, expectedDelivery: '2026-04-05', status: 'Draft', discrepancy: false },
];

export const seedQuotations = [
  { id: 'QT001', customerName: 'Ravi Kumar', items: [{ productId: 'P001', productName: 'Wireless Earbuds Pro', quantity: 10, price: 2499 }, { productId: 'P009', productName: 'Bluetooth Speaker', quantity: 5, price: 1899 }], validityDate: '2026-04-15', status: 'Sent', total: 34485, createdDate: '2026-03-25' },
  { id: 'QT002', customerName: 'Anjali Verma', items: [{ productId: 'P006', productName: 'Face Serum Vitamin C', quantity: 20, price: 899 }], validityDate: '2026-04-10', status: 'Accepted', total: 17980, createdDate: '2026-03-23' },
  { id: 'QT003', customerName: 'Manoj Tiwari', items: [{ productId: 'P010', productName: 'Running Shoes', quantity: 5, price: 3499 }], validityDate: '2026-04-20', status: 'Draft', total: 17495, createdDate: '2026-03-26' },
];

export const seedRawMaterials = [
  { materialId: 'RM001', materialName: 'Lithium Battery Cell', quantityPerUnit: 2, unit: 'pcs', costPerUnit: 180, currentStock: 500, minStock: 200, supplier: 'BatteryTech India', leadTimeDays: 10 },
  { materialId: 'RM002', materialName: 'Bluetooth Chipset', quantityPerUnit: 1, unit: 'pcs', costPerUnit: 250, currentStock: 300, minStock: 100, supplier: 'ChipMaster Pvt Ltd', leadTimeDays: 14 },
  { materialId: 'RM003', materialName: 'Silicone Ear Tips', quantityPerUnit: 6, unit: 'pcs', costPerUnit: 8, currentStock: 2000, minStock: 500, supplier: 'SiliFlex Corp', leadTimeDays: 7 },
  { materialId: 'RM004', materialName: 'ABS Plastic Shell', quantityPerUnit: 2, unit: 'pcs', costPerUnit: 35, currentStock: 800, minStock: 300, supplier: 'PlastiMold India', leadTimeDays: 5 },
  { materialId: 'RM005', materialName: 'Cotton Fabric (Grade A)', quantityPerUnit: 1.5, unit: 'meters', costPerUnit: 120, currentStock: 350, minStock: 150, supplier: 'TextileCraft Mills', leadTimeDays: 8 },
  { materialId: 'RM006', materialName: 'Elastic Band', quantityPerUnit: 0.5, unit: 'meters', costPerUnit: 15, currentStock: 600, minStock: 200, supplier: 'TextileCraft Mills', leadTimeDays: 5 },
  { materialId: 'RM007', materialName: 'Organic Tea Leaves', quantityPerUnit: 100, unit: 'grams', costPerUnit: 0.8, currentStock: 50000, minStock: 20000, supplier: 'TeaGarden Assam', leadTimeDays: 12 },
  { materialId: 'RM008', materialName: 'Cardboard Box (Tea)', quantityPerUnit: 1, unit: 'pcs', costPerUnit: 12, currentStock: 1500, minStock: 500, supplier: 'PackRight India', leadTimeDays: 4 },
  { materialId: 'RM009', materialName: 'LED Chip (Smart)', quantityPerUnit: 1, unit: 'pcs', costPerUnit: 65, currentStock: 200, minStock: 80, supplier: 'BrightChip Corp', leadTimeDays: 10 },
  { materialId: 'RM010', materialName: 'WiFi Module', quantityPerUnit: 1, unit: 'pcs', costPerUnit: 90, currentStock: 150, minStock: 60, supplier: 'ChipMaster Pvt Ltd', leadTimeDays: 14 },
  { materialId: 'RM011', materialName: 'PVC Yoga Mat Sheet', quantityPerUnit: 1, unit: 'sheet', costPerUnit: 280, currentStock: 120, minStock: 40, supplier: 'PolyFlex Industries', leadTimeDays: 7 },
  { materialId: 'RM012', materialName: 'Anti-slip Texture Coating', quantityPerUnit: 0.2, unit: 'liters', costPerUnit: 350, currentStock: 50, minStock: 15, supplier: 'CoatPro Labs', leadTimeDays: 9 },
  { materialId: 'RM013', materialName: 'Vitamin C Serum Base', quantityPerUnit: 30, unit: 'ml', costPerUnit: 3.5, currentStock: 8000, minStock: 3000, supplier: 'BioChemEssence', leadTimeDays: 11 },
  { materialId: 'RM014', materialName: 'Glass Dropper Bottle', quantityPerUnit: 1, unit: 'pcs', costPerUnit: 22, currentStock: 600, minStock: 200, supplier: 'GlassWorks India', leadTimeDays: 6 },
  { materialId: 'RM015', materialName: 'Speaker Driver 40mm', quantityPerUnit: 2, unit: 'pcs', costPerUnit: 150, currentStock: 250, minStock: 80, supplier: 'AudioParts India', leadTimeDays: 12 },
  { materialId: 'RM016', materialName: 'Rubber Sole (Running)', quantityPerUnit: 2, unit: 'pcs', costPerUnit: 320, currentStock: 80, minStock: 30, supplier: 'SoleTech India', leadTimeDays: 10 },
  { materialId: 'RM017', materialName: 'Mesh Fabric (Sports)', quantityPerUnit: 0.8, unit: 'meters', costPerUnit: 180, currentStock: 120, minStock: 50, supplier: 'TextileCraft Mills', leadTimeDays: 8 },
];

const rm = (i) => seedRawMaterials[i];

export const seedBoms = [
  { productId: 'P001', productName: 'Wireless Earbuds Pro', category: 'Electronics', outputPerBatch: 50, laborCostPerBatch: 5000, overheadPerBatch: 3000, materials: [rm(0), rm(1), rm(2), rm(3)] },
  { productId: 'P002', productName: 'Cotton T-Shirt Premium', category: 'Clothing', outputPerBatch: 100, laborCostPerBatch: 8000, overheadPerBatch: 2000, materials: [rm(4), rm(5)] },
  { productId: 'P003', productName: 'Organic Green Tea', category: 'Food & Beverages', outputPerBatch: 200, laborCostPerBatch: 3000, overheadPerBatch: 1500, materials: [rm(6), rm(7)] },
  { productId: 'P004', productName: 'Smart LED Bulb', category: 'Home & Garden', outputPerBatch: 80, laborCostPerBatch: 4000, overheadPerBatch: 2500, materials: [rm(8), rm(9), rm(3)] },
  { productId: 'P005', productName: 'Yoga Mat Premium', category: 'Sports', outputPerBatch: 40, laborCostPerBatch: 3500, overheadPerBatch: 1500, materials: [rm(10), rm(11)] },
  { productId: 'P006', productName: 'Face Serum Vitamin C', category: 'Beauty', outputPerBatch: 150, laborCostPerBatch: 6000, overheadPerBatch: 2000, materials: [rm(12), rm(13)] },
  { productId: 'P009', productName: 'Bluetooth Speaker', category: 'Electronics', outputPerBatch: 30, laborCostPerBatch: 4500, overheadPerBatch: 3500, materials: [rm(0), rm(1), rm(14), rm(3)] },
  { productId: 'P010', productName: 'Running Shoes', category: 'Sports', outputPerBatch: 60, laborCostPerBatch: 9000, overheadPerBatch: 3000, materials: [rm(15), rm(16)] },
];

export const seedProductionOrders = [
  { id: 'PRD001', productId: 'P001', productName: 'Wireless Earbuds Pro', batchSize: 100, status: 'In Progress', startDate: '2026-03-22', endDate: '2026-03-28', priority: 'High', completionPercent: 65, assignedTo: 'Line A' },
  { id: 'PRD002', productId: 'P002', productName: 'Cotton T-Shirt Premium', batchSize: 200, status: 'Planned', startDate: '2026-03-26', endDate: '2026-03-30', priority: 'Urgent', completionPercent: 0, assignedTo: 'Line B' },
  { id: 'PRD003', productId: 'P006', productName: 'Face Serum Vitamin C', batchSize: 150, status: 'Quality Check', startDate: '2026-03-18', endDate: '2026-03-25', priority: 'Medium', completionPercent: 90, assignedTo: 'Line C' },
  { id: 'PRD004', productId: 'P004', productName: 'Smart LED Bulb', batchSize: 80, status: 'Planned', startDate: '2026-03-27', endDate: '2026-04-01', priority: 'Urgent', completionPercent: 0, assignedTo: 'Line A' },
  { id: 'PRD005', productId: 'P009', productName: 'Bluetooth Speaker', batchSize: 60, status: 'In Progress', startDate: '2026-03-20', endDate: '2026-03-27', priority: 'Medium', completionPercent: 45, assignedTo: 'Line D' },
  { id: 'PRD006', productId: 'P010', productName: 'Running Shoes', batchSize: 60, status: 'Completed', startDate: '2026-03-10', endDate: '2026-03-18', priority: 'Low', completionPercent: 100, assignedTo: 'Line B' },
  { id: 'PRD007', productId: 'P003', productName: 'Organic Green Tea', batchSize: 400, status: 'In Progress', startDate: '2026-03-21', endDate: '2026-03-26', priority: 'High', completionPercent: 78, assignedTo: 'Line C' },
  { id: 'PRD008', productId: 'P005', productName: 'Yoga Mat Premium', batchSize: 40, status: 'Planned', startDate: '2026-03-28', endDate: '2026-04-02', priority: 'Low', completionPercent: 0, assignedTo: 'Line D' },
];

function extractCustomers(orders) {
  const map = new Map();
  orders.forEach((o) => {
    if (!map.has(o.customerName)) {
      map.set(o.customerName, {
        id: `C${String(map.size + 1).padStart(3, '0')}`,
        name: o.customerName,
        email: `${o.customerName.toLowerCase().replace(/\s+/g, '.')}@email.com`,
        phone: `+91 ${7000000000 + Math.floor(Math.random() * 2999999999)}`,
      });
    }
  });
  return Array.from(map.values());
}

export function buildSeedCustomers() {
  return extractCustomers(seedOrders);
}

export function computeBomCosts(boms) {
  return boms.map((bom) => {
    const totalMaterialCost = bom.materials.reduce((s, m) => s + m.quantityPerUnit * m.costPerUnit, 0);
    const totalCostPerUnit =
      totalMaterialCost + (bom.laborCostPerBatch + bom.overheadPerBatch) / bom.outputPerBatch;
    return { ...bom, totalMaterialCost, totalCostPerUnit };
  });
}
