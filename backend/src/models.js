import mongoose from 'mongoose';

const { Schema } = mongoose;

const userSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['admin', 'staff', 'viewer'], required: true },
    avatar: String,
  },
  { timestamps: true }
);

const productSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    name: String,
    category: String,
    price: Number,
    cost: Number,
    stock: Number,
    minStock: Number,
    unit: String,
    supplier: String,
    lastRestocked: String,
    salesLast30: Number,
    image: String,
    binLocation: String,
  },
  { timestamps: true }
);

const orderItemSchema = new Schema(
  {
    productId: String,
    productName: String,
    quantity: Number,
    price: Number,
  },
  { _id: false }
);

const orderSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    customerName: String,
    items: [orderItemSchema],
    total: Number,
    status: { type: String, enum: ['Placed', 'Processing', 'Shipped', 'Delivered', 'Cancelled'] },
    date: String,
    createdBy: String,
  },
  { timestamps: true }
);

const activityLogSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    userId: String,
    userName: String,
    action: String,
    details: String,
    timestamp: String,
  },
  { timestamps: true }
);

const purchaseOrderSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    supplier: String,
    productId: String,
    productName: String,
    quantityOrdered: Number,
    quantityReceived: { type: Schema.Types.Mixed, default: null },
    expectedDelivery: String,
    status: {
      type: String,
      enum: ['Draft', 'Sent', 'Acknowledged', 'In Transit', 'Received', 'Closed'],
    },
    dateSent: String,
    dateReceived: String,
    discrepancy: Boolean,
  },
  { timestamps: true }
);

const customerSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    name: String,
    email: String,
    phone: String,
  },
  { timestamps: true }
);

const returnItemSchema = new Schema(
  {
    productId: String,
    productName: String,
    quantity: Number,
    reason: String,
    condition: { type: String, enum: ['Resellable', 'Damaged', 'Defective'] },
  },
  { _id: false }
);

const returnRequestSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    orderId: String,
    items: [returnItemSchema],
    status: { type: String, enum: ['Pending', 'Approved', 'Rejected'] },
    timestamp: String,
    userName: String,
  },
  { timestamps: true }
);

const quotationItemSchema = new Schema(
  {
    productId: String,
    productName: String,
    quantity: Number,
    price: Number,
  },
  { _id: false }
);

const quotationSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    customerName: String,
    items: [quotationItemSchema],
    validityDate: String,
    status: { type: String, enum: ['Draft', 'Sent', 'Accepted', 'Rejected', 'Expired'] },
    total: Number,
    createdDate: String,
  },
  { timestamps: true }
);

const qcItemSchema = new Schema(
  {
    name: String,
    passed: { type: Schema.Types.Mixed, default: null },
    note: String,
  },
  { _id: false }
);

const qcChecklistSchema = new Schema(
  {
    productionOrderId: { type: String, required: true, unique: true, index: true },
    items: [qcItemSchema],
    completedBy: String,
    completedAt: String,
  },
  { timestamps: true }
);

const variantSchema = new Schema(
  {
    sku: String,
    attributes: { type: Schema.Types.Mixed, default: {} },
    stock: Number,
    price: Number,
  },
  { _id: false }
);

const productVariantGroupSchema = new Schema(
  {
    productId: { type: String, required: true, unique: true, index: true },
    variants: [variantSchema],
  },
  { timestamps: true }
);

const appSettingsSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    scheduledReport: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

const rawMaterialSchema = new Schema(
  {
    materialId: { type: String, required: true, unique: true, index: true },
    materialName: String,
    quantityPerUnit: Number,
    unit: String,
    costPerUnit: Number,
    currentStock: Number,
    minStock: Number,
    supplier: String,
    leadTimeDays: Number,
  },
  { timestamps: true }
);

const bomMaterialSchema = new Schema(
  {
    materialId: String,
    materialName: String,
    quantityPerUnit: Number,
    unit: String,
    costPerUnit: Number,
    currentStock: Number,
    minStock: Number,
    supplier: String,
    leadTimeDays: Number,
  },
  { _id: false }
);

const billOfMaterialsSchema = new Schema(
  {
    productId: { type: String, required: true, unique: true, index: true },
    productName: String,
    category: String,
    outputPerBatch: Number,
    laborCostPerBatch: Number,
    overheadPerBatch: Number,
    materials: [bomMaterialSchema],
    totalMaterialCost: Number,
    totalCostPerUnit: Number,
  },
  { timestamps: true }
);

const productionOrderSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    productId: String,
    productName: String,
    batchSize: Number,
    status: { type: String, enum: ['Planned', 'In Progress', 'Quality Check', 'Completed'] },
    startDate: String,
    endDate: String,
    priority: { type: String, enum: ['Low', 'Medium', 'High', 'Urgent'] },
    completionPercent: Number,
    assignedTo: String,
  },
  { timestamps: true }
);

export const User = mongoose.model('User', userSchema);
export const Product = mongoose.model('Product', productSchema);
export const Order = mongoose.model('Order', orderSchema);
export const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);
export const PurchaseOrder = mongoose.model('PurchaseOrder', purchaseOrderSchema);
export const Customer = mongoose.model('Customer', customerSchema);
export const ReturnRequest = mongoose.model('ReturnRequest', returnRequestSchema);
export const Quotation = mongoose.model('Quotation', quotationSchema);
export const QCChecklist = mongoose.model('QCChecklist', qcChecklistSchema);
export const ProductVariantGroup = mongoose.model('ProductVariantGroup', productVariantGroupSchema);
export const AppSettings = mongoose.model('AppSettings', appSettingsSchema);
export const RawMaterial = mongoose.model('RawMaterial', rawMaterialSchema);
export const BillOfMaterials = mongoose.model('BillOfMaterials', billOfMaterialsSchema);
export const ProductionOrder = mongoose.model('ProductionOrder', productionOrderSchema);
