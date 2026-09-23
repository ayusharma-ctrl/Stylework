import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { config } from '../../config/config';
import { LeadsModule } from '../leads/leads.module';
import { ActivitiesModule } from '../activities/activities.module';
import { QueriesResolver } from './queries.resolver';
import { queryProtection } from './query-protection';
@Module({
  imports: [
    LeadsModule,
    ActivitiesModule,
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: true,
      sortSchema: true,
      playground: false,
      introspection: config.NODE_ENV !== 'production',
      csrfPrevention: true,
      allowBatchedHttpRequests: false,
      includeStacktraceInErrorResponses: false,
      context: ({ req, res }: any) => ({ req, res }),
      plugins: [queryProtection()],
    }),
  ],
  providers: [QueriesResolver],
})
export class QueriesModule {}
