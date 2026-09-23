import type { ApolloDriverConfig } from '@nestjs/apollo';
import { DocumentNode, FragmentDefinitionNode, GraphQLError, Kind, SelectionSetNode } from 'graphql';
import { fieldExtensionsEstimator, getComplexity, simpleEstimator } from 'graphql-query-complexity';
export function inspectDocument(document: DocumentNode) {
  const operations = document.definitions.filter((d) => d.kind === Kind.OPERATION_DEFINITION);
  if (operations.length !== 1)
    throw new GraphQLError('Exactly one operation is allowed', {
      extensions: { code: 'QUERY_LIMIT', http: { status: 400 } },
    });
  const fragments = new Map(
    document.definitions
      .filter((d): d is FragmentDefinitionNode => d.kind === Kind.FRAGMENT_DEFINITION)
      .map((d) => [d.name.value, d]),
  );
  let aliases = 0,
    fields = 0;
  function inspect(set: SelectionSetNode, depth: number, seen: Set<string>) {
    if (depth > 8)
      throw new GraphQLError('Query depth exceeds 8', {
        extensions: { code: 'QUERY_LIMIT', http: { status: 400 } },
      });
    for (const selection of set.selections) {
      if (selection.kind === Kind.FIELD) {
        if (++fields > 2000 || (selection.alias && ++aliases > 20))
          throw new GraphQLError('Query selection limit exceeded', {
            extensions: { code: 'QUERY_LIMIT', http: { status: 400 } },
          });
        if (selection.selectionSet) inspect(selection.selectionSet, depth + 1, seen);
      } else if (selection.kind === Kind.INLINE_FRAGMENT) inspect(selection.selectionSet, depth, seen);
      else {
        const name = selection.name.value;
        if (seen.has(name)) throw new GraphQLError('Cyclic fragments are not allowed');
        const fragment = fragments.get(name);
        if (fragment) inspect(fragment.selectionSet, depth, new Set([...seen, name]));
      }
    }
  }
  const operation = operations[0];
  if (operation?.kind === Kind.OPERATION_DEFINITION) inspect(operation.selectionSet, 1, new Set());
}
export function queryProtection(): NonNullable<ApolloDriverConfig['plugins']>[number] {
  return {
    async requestDidStart() {
      return {
        async didResolveOperation(ctx) {
          inspectDocument(ctx.document!);
          const cost = getComplexity({
            schema: ctx.schema,
            query: ctx.document!,
            variables: ctx.request.variables || {},
            operationName: ctx.operationName || undefined,
            estimators: [fieldExtensionsEstimator(), simpleEstimator({ defaultComplexity: 1 })],
          });
          if (cost > 1000)
            throw new GraphQLError('Query complexity exceeds 1000; request fewer rows or fields', {
              extensions: { code: 'QUERY_LIMIT', http: { status: 400 } },
            });
        },
        async willSendResponse(ctx) {
          if (ctx.response.body.kind === 'single')
            ctx.response.body.singleResult.extensions = {
              ...ctx.response.body.singleResult.extensions,
              requestId: ctx.contextValue.req?.requestId,
            };
        },
      };
    },
  };
}
