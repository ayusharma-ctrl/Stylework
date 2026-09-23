import { Sequelize } from 'sequelize';
export const statusIds = [1,2,3,4,5].map(n => '00000000-0000-4000-8000-' + String(n).padStart(12,'0'));
export async function seedReference(db: Sequelize) {
  await db.transaction(async transaction => {
    const names = ['Open','Contacted','Qualified','Disqualified','Converted'];
    const colors = ['#3b82f6','#8b5cf6','#f59e0b','#64748b','#14b8a6'];
    for (let i=0;i<names.length;i++) await db.query(
      'INSERT INTO statuses(id,name,color,position) VALUES(:id,:name,:color,:position) ON CONFLICT(id) DO NOTHING',
      { replacements: { id: statusIds[i], name: names[i], color: colors[i], position: i }, transaction });
    await db.query("INSERT INTO workspace_settings(id,default_status_id,timezone) VALUES(1,:id,'Asia/Kolkata') ON CONFLICT(id) DO NOTHING", { replacements: { id: statusIds[0] }, transaction });
  });
}
