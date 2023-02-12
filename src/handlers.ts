import { APIGatewayProxyEvent, APIGatewayProxyEventStringParameters, APIGatewayProxyResult } from "aws-lambda";
import AWS, { AWSError } from "aws-sdk";
type Action = "$connect" | "$disconnect" | "getMessages" | "sendMessage" | "getClients";
type Client = {
    connectionId: string,
    nickname: string
} 
const docClient = new AWS.DynamoDB.DocumentClient();
const CLIENT_TABLE_NAME = "Clients";
const responseOk = {
    statusCode: 200,
    body: ""
};
const apiGw = new AWS.ApiGatewayManagementApi({
    endpoint: process.env['WSSAPIGATEWAYENDPOINT']
});
export const handle = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const connectionId = event.requestContext.connectionId as string;
    const routeKey = event.requestContext.routeKey as Action;
    switch (routeKey) {
        case "$connect":
            return handleConnect(connectionId, event.queryStingParameters);
        case "$disconnect":
            return handleDisconnect(connectionId);
        case "getMessages":
            return handleGetMessages(connectionId);
        default:
            return {
                statusCode: 500,
                body: "",
            };
    }  
};

const handleConnect = async (
    connectionId: string, 
    queryParams: APIGatewayProxyEventStringParameters | null
    ): Promise<APIGatewayProxyResult> => {
    if(!queryParams || !queryParams["nickname"]){
        return {
            statusCode: 403,
            body: ""
        }
    }

    await docClient.put({
        TableName: CLIENT_TABLE_NAME,
        Item: {
            connectionId, 
            nickname: queryParams["nickname"]
        },
    }).promise();

    await notifyClients(connectionId);
    return responseOk;
}


const handleDisconnect = async (
    connectionId: string
    ): Promise<APIGatewayProxyResult> => {
        await docClient.delete({
            TableName: CLIENT_TABLE_NAME,
            Key: {
                connectionId
        }
    }).promise();
    await notifyClients(connectionId);
    return responseOk;
}

const notifyClients = async (connectionIdToExclude:string) => {
    const clients = await getAllCLients();
    await Promise.all(
        clients.filter((client) => client.connectionId !== connectionIdToExclude)
        .map(async (client) => {
            await postToConnection(client.connectionId, JSON.stringify(clients));
        })
    );
}

const getAllCLients = async (): Promise<Client[]> => {
    const outPut = await docClient.scan({
        TableName: CLIENT_TABLE_NAME
    }).promise();
    const clients = outPut.Items || [];
    return clients as Client[];
}

const postToConnection = async (connectionId:string, data: string) => {
    try{
        await apiGw.postToConnection({
            ConnectionId: connectionId,
            Data: data
        })
        .promise();
    } catch(e){
        if((e as AWSError).statusCode !== 401){
            throw e;
        }
        await docClient.delete({
            TableName: CLIENT_TABLE_NAME,
            Key: {
                connectionId
            }
        }).promise();
    }
    return responseOk;
}

const handleGetMessages = async (connectionId: string): Promise<APIGatewayProxyResult> => {
    const clients = await getAllCLients();
    await postToConnection(connectionId, JSON.stringify(clients));

}