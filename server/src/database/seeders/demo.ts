import { Sequelize } from 'sequelize';
export async function seedDemo(db: Sequelize, count = 150) {
  if (!Number.isSafeInteger(count) || count < 1 || count > 200) throw new Error('SEED_COUNT must be 1..200');
  // Batch writes keep memory and transactions bounded. Deterministic identifiers make reruns additive.
  await db.query(`INSERT INTO users(id,email,meta)
    SELECT ('10000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
    'teammate'||i||'@example.test', jsonb_build_object('theme',CASE WHEN i%3=0 THEN 'dark' ELSE 'light' END)
    FROM generate_series(1,12) i ON CONFLICT DO NOTHING`);
  for (let start = 1; start <= count; start += 1000) {
    await db.transaction(async (transaction) => {
      await db.query(
        `
WITH inserted AS (
 INSERT INTO leads(id,source,external_id,source_version,source_hash,source_occurred_at,full_name,email,phone,company,campaign,status_id,created_at,updated_at,metadata)
 SELECT ('20000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'seed','sample-'||i,1,repeat('0',64),
 now() - ((CASE WHEN i<=3 THEN i*60 WHEN i<=6 THEN 86400+i*60 ELSE i::bigint*15485863 % 31536000 END) * interval '1 second'),
 (ARRAY['Aarav','Diya','Kabir','Ananya','Arjun','Isha','Rohan','Meera','Vihaan','Sana','Aditya','Kavya','Neil','Zara','Dev','Maya'])[1+(i%16)]
 ||' '||(ARRAY['Sharma','Patel','Mehta','Rao','Singh','Kapoor','Shah','Joshi','Nair','Gupta','Malhotra','Das','Verma'])[1+((i/16)%13)],
 'lead'||i||'@example.test','+91'||lpad((9000000000+i)::text,10,'0'),
 (ARRAY['Orbit Labs','Northstar','Apex Studio','Urban Company','Meridian','Cloudnine','Elevate','Brightside'])[1+(i%8)],
 (ARRAY['Summer workspace','Founder community','Remote teams','Enterprise spaces'])[1+(i%4)],
 ('00000000-0000-4000-8000-'||lpad((CASE WHEN i<=75 THEN 2+i%4 ELSE 1 END)::text,12,'0'))::uuid,
 now() - ((CASE WHEN i<=3 THEN i*60 WHEN i<=6 THEN 86400+i*60 ELSE i::bigint*15485863 % 31536000 END) * interval '1 second'),
 now() - (greatest(0,(CASE WHEN i<=3 THEN i*60 WHEN i<=6 THEN 86400+i*60 ELSE i::bigint*15485863 % 31536000 END)-120) * interval '1 second'),
 jsonb_build_object('seed',true)
 FROM generate_series(:start,:end) i ON CONFLICT(source,external_id) DO NOTHING RETURNING *
), created AS (
 INSERT INTO activities(lead_id,entity_id,entity_type,type,actor,summary,after,request_id,created_at)
 SELECT id,id,'lead','LEAD_CREATED','{"kind":"webhook","label":"Demo import"}'::jsonb,
 'Lead created: '||full_name,jsonb_build_object('fullName',full_name,'status',jsonb_build_object('id','00000000-0000-4000-8000-000000000001','name',(SELECT name FROM statuses WHERE id='00000000-0000-4000-8000-000000000001'))),gen_random_uuid(),created_at FROM inserted
)
INSERT INTO activities(lead_id,entity_id,entity_type,type,actor_id,actor,summary,before,after,request_id,created_at)
SELECT i.id,i.id,'lead','STATUS_CHANGED','10000000-0000-4000-8000-000000000001'::uuid,
 '{"kind":"user","label":"teammate1@example.test"}'::jsonb, 'Status changed to '||s.name,
 jsonb_build_object('status',jsonb_build_object('id','00000000-0000-4000-8000-000000000001','name',(SELECT name FROM statuses WHERE id='00000000-0000-4000-8000-000000000001'))),jsonb_build_object('status',jsonb_build_object('id',s.id,'name',s.name)),gen_random_uuid(),i.updated_at
FROM inserted i JOIN statuses s ON s.id=i.status_id WHERE s.id<>'00000000-0000-4000-8000-000000000001'
`,
        { replacements: { start, end: Math.min(start + 999, count) }, transaction },
      );
    });
  }
  await rebuildCounters(db);
}
export async function rebuildCounters(db: Sequelize) {
  await db.transaction(async (transaction) => {
    // Maintenance-only command: blocks lead writes while taking an exact replacement snapshot.
    await db.query("SET LOCAL statement_timeout = '10min'", { transaction });
    await db.query('LOCK TABLE leads,activities IN SHARE MODE', { transaction });
    await db.query('DELETE FROM dashboard_counters', { transaction });
    await db.query(
      `
INSERT INTO dashboard_counters(key,shard,value)
 SELECT 'total',get_byte(decode(replace(id::text,'-',''),'hex'),15)%64,count(*) FROM leads GROUP BY 2
 UNION ALL
 SELECT 'activity',get_byte(decode(replace(entity_id::text,'-',''),'hex'),15)%64,count(*) FROM activities GROUP BY 2
 UNION ALL
 SELECT 'status:'||status_id,get_byte(decode(replace(id::text,'-',''),'hex'),15)%64,count(*) FROM leads GROUP BY 1,2
 UNION ALL
 SELECT 'day:'||to_char(created_at AT TIME ZONE (SELECT timezone FROM workspace_settings WHERE id=1),'YYYY-MM-DD'),
 get_byte(decode(replace(id::text,'-',''),'hex'),15)%64,count(*) FROM leads GROUP BY 1,2
`,
      { transaction },
    );
  });
}
