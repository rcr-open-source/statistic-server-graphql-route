/* eslint-disable object-curly-newline */
import "reflect-metadata";
import { API } from "@umk-stat/statistic-server-database";
import { OptionsData, graphqlHTTP, Options } from "express-graphql";
import { NonEmptyArray, buildSchemaSync } from "type-graphql";
import { PubSub } from "graphql-subscriptions";
import { IncomingMessage, ServerResponse } from "http";
import { GraphQLSchema } from "graphql";
import { Logger } from "winston";
import { Context, GlobalResolver } from "@umk-stat/statistic-server-core";
import { SystemResolver } from "@umk-stat/statistic-server-system-graphql";
import { BackendLogsResolver } from "@umk-stat/statistic-server-graphql-logs-graphql";


export function getMiddleware(
    databaseAPI: API,
    infoLogger: Logger,
    errorLogger: Logger,
): {
    middleware: ReturnType<typeof graphqlHTTP>,
    schema: GraphQLSchema,
} {

    const pubSub = new PubSub();
    const resolvers: NonEmptyArray<Function> = [
        BackendLogsResolver,
        SystemResolver,
        GlobalResolver,
    ];

    const schema = buildSchemaSync({
        resolvers,
        pubSub,
        emitSchemaFile: {
            path: `${__dirname}/../../../schema_statistic.gql`,
        },
    });
    const func: Options = async (
        request: IncomingMessage,
    ): Promise<OptionsData> => {

        const map = await databaseAPI.queries.findMapAssociations();
        const graphqlMap = map.reduce((prev, val) => {

            const value = val.get();
            prev.set(value.NUMBER, value.tableName);
            return prev;

        }, new Map<string, string>());
        return {
            schema,
            customFormatErrorFn: (err: Error): { message: string } => ({
                message: err.message,
            }),
            graphiql: true,
            context: new Context(
                databaseAPI,
                infoLogger,
                errorLogger,
                graphqlMap,
            ),
        };

    };

    return {
        middleware: graphqlHTTP(func),
        schema,
    }

}
