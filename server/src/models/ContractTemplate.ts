import { Schema, model, Document, Types } from 'mongoose';

export interface IContractTemplate extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  name: string;
  html: string;
  isDefault: boolean;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ContractTemplateSchema = new Schema<IContractTemplate>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    name: { type: String, required: true, trim: true },
    html: { type: String, required: true },
    isDefault: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

ContractTemplateSchema.index({ tenantId: 1, isDefault: 1 });

export const ContractTemplate = model<IContractTemplate>('ContractTemplate', ContractTemplateSchema);
