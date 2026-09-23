import {Sequelize} from 'sequelize';
export async function up(db:Sequelize) {
 await db.query(`CREATE TABLE webhook_credentials (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name varchar(80) NOT NULL,
 key_hash varchar(64) NOT NULL UNIQUE,key_prefix varchar(12) NOT NULL,
 revoked_at timestamptz,expires_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
 )`);
}
