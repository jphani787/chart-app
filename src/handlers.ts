import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

export const handle = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    return {
        statusCode: 200,
        body: JSON.stringify({
            message: "Go Serverless v1.0",
            input: event
        }, null, 2,),
    };
};