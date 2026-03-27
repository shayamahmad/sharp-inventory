export type UserRole = 'admin' | 'staff' | 'viewer';

export interface User {
  id: string;
  name: string;
  email: string;
  /** Only present for mock login or when creating users; omitted after API login */
  password?: string;
  role: UserRole;
  avatar?: string;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  cost: number;
  stock: number;
  minStock: number;
  unit: string;
  supplier: string;
  lastRestocked: string;
  salesLast30: number;
  image?: string;
}

export interface Order {
  id: string;
  customerName: string;
  items: { productId: string; productName: string; quantity: number; price: number }[];
  total: number;
  status: 'Placed' | 'Processing' | 'Shipped' | 'Delivered' | 'Cancelled';
  date: string;
  createdBy: string;
}

export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  details: string;
  timestamp: string;
}

export interface Notification {
  id: string;
  type: 'low_stock' | 'dead_stock' | 'high_demand' | 'order' | 'admin';
  title: string;
  message: string;
  read: boolean;
  timestamp: string;
}

export const users: User[] = [
  { id: '1', name: 'Sneha Khatry', email: 'admin@inveto.com', password: 'admin123', role: 'admin' },
  { id: '2', name: 'Priya Sharma', email: 'staff@inveto.com', password: 'staff123', role: 'staff' },
  { id: '3', name: 'Amit Patel', email: 'viewer@inveto.com', password: 'viewer123', role: 'viewer' },
];

export const categories = ['Electronics', 'Clothing', 'Food & Beverages', 'Home & Garden', 'Sports', 'Beauty', 'Toys', 'Books'];

export const products: Product[] = [
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
  // Dead stock items (low sales, some stock sitting)
  { id: 'P016', name: 'Vintage Wall Clock', category: 'Home & Garden', price: 1899, cost: 900, stock: 42, minStock: 10, unit: 'pcs', supplier: 'GreenHome Supplies', lastRestocked: '2025-12-15', salesLast30: 1 },
  { id: 'P017', name: 'Knitting Yarn Bundle', category: 'Toys', price: 399, cost: 150, stock: 85, minStock: 20, unit: 'packs', supplier: 'PlayZone India', lastRestocked: '2025-11-20', salesLast30: 2 },
  { id: 'P018', name: 'Calligraphy Pen Set', category: 'Books', price: 749, cost: 350, stock: 60, minStock: 10, unit: 'sets', supplier: 'BookWorld Publishers', lastRestocked: '2026-01-05', salesLast30: 0 },
];

export const orders: Order[] = [
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

export const activityLogs: ActivityLog[] = [
  { id: 'A1', userId: '1', userName: 'Sneha Khatry', action: 'Created Order', details: 'Order ORD001 for Vikram Singh', timestamp: '2026-03-24 14:30' },
  { id: 'A2', userId: '2', userName: 'Priya Sharma', action: 'Added Product', details: 'Added 50 units of Masala Chai Pack', timestamp: '2026-03-24 11:15' },
  { id: 'A3', userId: '1', userName: 'Sneha Khatry', action: 'Updated Stock', details: 'Restocked Wireless Earbuds Pro (+100 units)', timestamp: '2026-03-23 16:45' },
  { id: 'A4', userId: '2', userName: 'Priya Sharma', action: 'Created Order', details: 'Order ORD002 for Neha Gupta', timestamp: '2026-03-25 09:20' },
  { id: 'A5', userId: '1', userName: 'Sneha Khatry', action: 'Deleted Product', details: 'Removed discontinued item: Old Model Charger', timestamp: '2026-03-22 10:00' },
  { id: 'A6', userId: '3', userName: 'Amit Patel', action: 'Viewed Report', details: 'Accessed monthly sales report', timestamp: '2026-03-25 08:00' },
];

export const notifications: Notification[] = [
  { id: 'N1', type: 'low_stock', title: 'Low Stock Alert', message: 'Cotton T-Shirt Premium has only 8 units left (min: 50)', read: false, timestamp: '2026-03-25 10:00' },
  { id: 'N2', type: 'low_stock', title: 'Critical Stock', message: 'Smart LED Bulb has only 3 units remaining!', read: false, timestamp: '2026-03-25 09:30' },
  { id: 'N3', type: 'dead_stock', title: 'Dead Stock Alert', message: 'Vintage Wall Clock — 42 units sitting, only 1 sold in 30 days', read: false, timestamp: '2026-03-25 08:00' },
  { id: 'N4', type: 'high_demand', title: 'High Demand', message: 'Masala Chai Pack sold 189 units this month — consider restocking', read: true, timestamp: '2026-03-24 18:00' },
  { id: 'N5', type: 'order', title: 'New Order', message: 'Order ORD004 placed by Divya Rao (₹1,990)', read: true, timestamp: '2026-03-25 09:20' },
  { id: 'N6', type: 'admin', title: 'Staff Login', message: 'Priya Sharma logged in at 09:00 AM', read: true, timestamp: '2026-03-25 09:00' },
  { id: 'N7', type: 'dead_stock', title: 'Dead Stock Alert', message: 'Knitting Yarn Bundle — 85 units unsold, only 2 sales in 30 days', read: false, timestamp: '2026-03-25 07:30' },
  { id: 'N8', type: 'dead_stock', title: 'Dead Stock Alert', message: 'Calligraphy Pen Set — 60 units with ZERO sales in 30 days', read: false, timestamp: '2026-03-25 07:00' },
  { id: 'N9', type: 'high_demand', title: 'High Demand', message: 'Cotton T-Shirt Premium sold 156 units but stock is critically low!', read: false, timestamp: '2026-03-24 17:00' },
  { id: 'N10', type: 'order', title: 'Bulk Order', message: 'Order ORD012 — Lakshmi Iyer placed ₹5,725 bulk order', read: true, timestamp: '2026-03-17 14:00' },
  { id: 'N11', type: 'low_stock', title: 'Low Stock Alert', message: 'Face Serum Vitamin C has only 15 units left (min: 25)', read: false, timestamp: '2026-03-25 06:00' },
  { id: 'N12', type: 'admin', title: 'New Staff Added', message: 'Admin added a new staff member to the system', read: true, timestamp: '2026-03-24 10:00' },
];

export const monthlySales = [
  { month: 'Oct', revenue: 285000, orders: 142, profit: 98000 },
  { month: 'Nov', revenue: 340000, orders: 178, profit: 125000 },
  { month: 'Dec', revenue: 520000, orders: 265, profit: 195000 },
  { month: 'Jan', revenue: 380000, orders: 190, profit: 142000 },
  { month: 'Feb', revenue: 410000, orders: 205, profit: 158000 },
  { month: 'Mar', revenue: 475000, orders: 238, profit: 180000 },
];

export const categorySales = [
  { name: 'Electronics', value: 185000, fill: 'hsl(25, 95%, 53%)' },
  { name: 'Food & Bev', value: 142000, fill: 'hsl(165, 70%, 42%)' },
  { name: 'Clothing', value: 98000, fill: 'hsl(262, 60%, 55%)' },
  { name: 'Beauty', value: 87000, fill: 'hsl(340, 75%, 55%)' },
  { name: 'Sports', value: 76000, fill: 'hsl(200, 80%, 50%)' },
  { name: 'Home', value: 45000, fill: 'hsl(45, 93%, 47%)' },
  { name: 'Books', value: 22000, fill: 'hsl(160, 40%, 50%)' },
  { name: 'Toys', value: 15000, fill: 'hsl(0, 60%, 55%)' },
];

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

export function getStockStatus(product: Product): 'out' | 'critical' | 'low' | 'ok' {
  if (product.stock === 0) return 'out';
  if (product.stock <= product.minStock * 0.3) return 'critical';
  if (product.stock <= product.minStock) return 'low';
  return 'ok';
}

export function predictDaysUntilStockout(product: Product): number | null {
  if (product.salesLast30 === 0) return null;
  const dailySales = product.salesLast30 / 30;
  return Math.floor(product.stock / dailySales);
}
