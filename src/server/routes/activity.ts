'use strict';
import { Request, Response } from "express";
import { VerifyErrors, verify } from 'jsonwebtoken';

interface ExecuteLog {
    body: any;
    headers: any;
    trailers: any;
    method: any;
    url: any;
    params: any;
    query: any;
    route: any;
    cookies: any;
    ip: any;
    path: any;
    host: any;
    fresh: any;
    stale: any;
    protocol: any;
    secure: any;
    originalUrl: any;
}
const logExecuteData: ExecuteLog[] = [];
const logData = (req: Request) => {
    logExecuteData.push({
        body: req.body,
        headers: req.headers,
        trailers: req.trailers,
        method: req.method,
        url: req.url,
        params: req.params,
        query: req.query,
        route: req.route,
        cookies: req.cookies,
        ip: req.ip,
        path: req.path,
        host: req.host,
        fresh: req.fresh,
        stale: req.stale,
        protocol: req.protocol,
        secure: req.secure,
        originalUrl: req.originalUrl
    });
}

import axios from 'axios';

interface InputParamenter {
    campaignName?: string;
    templateName?: string;
    phoneNumber?: string;
    variables?: string;
}
interface DecodedBody {
    inArguments?: InputParamenter[];
}

const {
    env: {
        SALESFORCE_JWT_SECRET,
        CHANNEL_ID,
        ACCESS_TOKEN,
        API_BASE_URL,
    },
} = process;

const execute = async function (req: Request, res: Response) {
    const { body } = req;

    console.log('POST /execute request received.');

    if (!body) {
        console.error(new Error('invalid jwtdata'));
        return res.status(401).end();
    }
    if (!SALESFORCE_JWT_SECRET) {
        console.error(new Error('jwtSecret not provided'));
        return res.status(401).end();
    }

    verify(
        body.toString('utf8'),
        SALESFORCE_JWT_SECRET,
        { algorithms: ['HS256'], complete: false },
        async (err: VerifyErrors | null, _decoded?: any) => {
            if (err) {
                console.log('POST /execute request error when decoding.', err);
                console.error(err);
                return res.status(401).end();
            }
            console.log('POST /execute request decoded.', JSON.stringify(_decoded));
            res.setHeader('Content-Type', 'application/json');
            res.status(200);

            if (_decoded && 'inArguments' in _decoded) {
                const decoded: DecodedBody = { ..._decoded };

                if (decoded.inArguments && decoded.inArguments.length > 0) {
                    let templateName: string | null = null;
                    let phoneNumber: string | null = null;
                    let variables: string | null = null;
                    for (const argument of decoded.inArguments) {
                        if (argument.templateName) templateName = argument.templateName;
                        if (argument.phoneNumber) phoneNumber = argument.phoneNumber;
                        if (argument.variables) variables = argument.variables;
                    }
                    if (!templateName || !phoneNumber || !variables) return res.status(400).send('Input parameter is missing.');

                    console.log('TEMPLATE NAME:', templateName);
                    console.log('PHONE NUMBER:', phoneNumber);
                    console.log('UNPARSED VARIABLES:', variables);

                    const requestJsonBody: {
                        campaign: null;
                        channelId: string;
                        name: string;
                        intentIdOrName: string;
                        contacts: {
                            contactId: string;
                            variables?: Record<string, string>;
                        }[];
                    } = {
                        campaign: null,
                        channelId: CHANNEL_ID!,
                        name: templateName,
                        intentIdOrName: templateName,
                        contacts: [{ contactId: phoneNumber }],
                    };

                    if (variables !== 'NO_VARIABLES') {
                        const parsedVariables = deserializeString(variables);
                        console.log('PARSED VARIABLES:', parsedVariables);
                        const variablesNumber = Object.keys(parsedVariables).length;
                        if (variablesNumber) {
                            // Check for null, undefined, or empty string values in parsedVariables
                            for (const [key, value] of Object.entries(parsedVariables)) {
                                if (!value) return res.status(400).send(`Value for variable "${key}" is invalid: ${value}.`);
                            }
                            requestJsonBody.contacts[0].variables = parsedVariables;
                        }
                    }

                    let result: { success: boolean };
                    
                    console.log('NOTIFICATION_REQUEST_BODY:');
                    console.dir(requestJsonBody, { depth: null });
                    try {
                        const { data, status } = await axios.post(
                            `${API_BASE_URL}/notifications`,
                            requestJsonBody,
                            { headers: { 'access-token': ACCESS_TOKEN } },
                        );
                        if (status === 201) {
                            console.log(`Success for ${phoneNumber}`);
                            result = { success: true };
                        } else {
                            console.warn('NOTIFICATION_REQUEST_DID_NOT_SUCCEED', { ...data, statusCode: status });
                            result = { success: false };
                        }
                    } catch (err: any) {
                        if (err.response) {
                            console.error('NOTIFICATION_REQUEST_FAILED - Server error', {
                                status: err.response.status,
                                data: err.response.data,
                            });
                            console.dir(err.response.data, { depth: null });
                        } else if (err.request) {
                            console.error('NOTIFICATION_REQUEST_FAILED - No response received', err.request);
                        } else {
                            console.error('NOTIFICATION_REQUEST_FAILED - Unexpected error', err.message);
                        }
                        result = { success: false };
                    }

                    return res.send(result);
                } else {
                    console.error('inArguments invalid.');
                    return res.status(400).end();
                }
            }
        },
    );
};

const edit = (req: any, res: any) => {
    logData(req);
    res.send(200, 'Edit');
};

const save = (req: any, res: any) => {
    logData(req);
    res.send(200, 'Save');
};

const publish = (req: any, res: any) => {
    logData(req);
    res.send(200, 'Publish');
};

const validate = (req: any, res: any) => {
    logData(req);
    res.send(200, 'Validate');
};

const stop = (req: any, res: any) => {
    logData(req);
    res.send(200, 'Stop');
};

function specialConsoleLog (
    eventName: string,
    data: any,
): void {
    const now = new Date();
    const todayDate = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
    const currentTime = `${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`;
    const jsonifiedData = JSON.stringify(data);
    console.log(`${todayDate}|${currentTime}|${eventName}|${jsonifiedData}`);
}

function deserializeString(str: string) {
    const result: {[variableName: string]: string} = {};
    str.split(';').forEach(pair => {
        const [key, ...rest] = pair.split('=');
        result[key] = rest.join('='); // Handles '=' inside the value
    });
    return result;
}

export default {
    logExecuteData,
    execute,
    edit,
    save,
    publish,
    validate,
    stop,
};
