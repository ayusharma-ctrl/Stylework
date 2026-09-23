import { DataTypes as D, DataType } from 'sequelize';
export const id = { type: D.UUID, primaryKey: true, defaultValue: D.UUIDV4 };
export const required = (type: DataType) => ({ type, allowNull: false });
