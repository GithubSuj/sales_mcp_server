#!/usr/bin/env node
'use strict'

const https = require('https')
const rl    = require('readline').createInterface({ input: process.stdin })

// The endpoint where your CAP application is running on SAP BTP Cloud Foundry
const BTP_URL =  '<BTP_MCP_URL>'  // e.g. https://<your-app-name>.<region>.cfapps.<domain>'

/**
 * Sends a POST request to forward the tool execution to your BTP CAP project.
 */
function httpPost(path, body) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(body)
        const url  = new URL(path, BTP_URL)
        
        const req  = https.request(url, {
            method:  'POST',
            headers: { 
                'Content-Type': 'application/json', 
                'Content-Length': Buffer.byteLength(data) 
            },
        }, res => {
            let raw = ''
            res.on('data', c => raw += c)
            res.on('end', () => {
                try { 
                    resolve(JSON.parse(raw)) 
                } catch { 
                    resolve({ error: raw }) 
                }
            })
        })
        
        req.on('error', reject)
        req.write(data)
        req.end()
    })
}

// Declaring the tools that Claude Desktop will register and see
const TOOL_DEFS = [
    {
        name: "read_sales_order",
        description: "Retrieve a specific sales order or list sales orders from the Sales Order OData service.",
        inputSchema: {
            type: "object",
            properties: {
                salesOrderId: {
                    type: "string",
                    maxLength: 10,
                    description: "Sales order key from the API_SALES_ORDER_SRV entity set.",
                },
                filter: {
                    type: "string",
                    description: "OData $filter expression to narrow the returned sales orders.",
                },
                top: {
                    type: "integer",
                    minimum: 1,
                    description: "Maximum number of sales orders to return.",
                },
                skip: {
                    type: "integer",
                    minimum: 0,
                    description: "Number of sales orders to skip in the result set.",
                },
            },
            additionalProperties: false,
        }
    },
    {
        name: "create_sales_order",
        description: "Create a new sales order header with line items via deep insert into the Sales Order OData service.",
        inputSchema: {
            type: "object",
            properties: {
                SalesOrder: {
                    type: "string",
                    maxLength: 10,
                    description: "Sales order key. If not supplied by the backend, provide the key that should be created.",
                },
                SalesOrderType: { type: "string", maxLength: 4 },
                SalesOrganization: { type: "string", maxLength: 4 },
                DistributionChannel: { type: "string", maxLength: 2 },
                OrganizationDivision: { type: "string", maxLength: 2 },
                SoldToParty: { type: "string", maxLength: 10 },
                PurchaseOrderByCustomer: { type: "string", maxLength: 35 },
                SalesOrderDate: { type: "string", format: "date" },
                TransactionCurrency: { type: "string", maxLength: 5 },
                RequestedDeliveryDate: { type: "string", format: "date" },
                ShippingCondition: { type: "string", maxLength: 2 },
                CustomerPaymentTerms: { type: "string", maxLength: 4 },
                to_Item: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            SalesOrderItem: { type: "string", maxLength: 6 },
                            Material: { type: "string", maxLength: 40 },
                            RequestedQuantity: { type: "number" },
                            RequestedQuantityUnit: { type: "string", maxLength: 3 },
                            RequestedQuantityISOUnit: { type: "string", maxLength: 3 },
                            OrderQuantityUnit: { type: "string", maxLength: 3 },
                            SalesOrderItemCategory: { type: "string", maxLength: 4 },
                            SalesOrderItemText: { type: "string", maxLength: 40 },
                            RequestedDeliveryDate: { type: "string", format: "date" },
                        },
                        required: ["SalesOrderItem"],
                        additionalProperties: false,
                    },
                },
            },
            required: ["SalesOrder", "SalesOrganization", "DistributionChannel", "OrganizationDivision", "SoldToParty", "TransactionCurrency", "to_Item"],
            additionalProperties: false,
        }
    }
]

function send(msg) {
    process.stdout.write(JSON.stringify(msg) + '\n')
}

async function handle(msg) {
    const { id, method, params } = msg

    // 1. Handshake Initiation
    if (method === 'initialize') {
        return send({ 
            jsonrpc: '2.0', 
            id, 
            result: {
                protocolVersion: '2024-11-05',
                serverInfo: { name: 'sales-order-mcp', version: '1.0.0' },
                capabilities: { tools: {} },
            }
        })
    }

    if (method === 'notifications/initialized') return

    // 2. Claude asks for tools
    if (method === 'tools/list') {
        return send({ jsonrpc: '2.0', id, result: { tools: TOOL_DEFS } })
    }

    // 3. Claude invokes a tool
    if (method === 'tools/call') {
        const { name, arguments: args } = params || {}
        try {
            // Forwards the tool execution payload directly to your CAP route in BTP
            const btpRes = await httpPost('/mcp/call', { tool: name, input: args || {} })
            
            if (btpRes.error) {
                return send({ 
                    jsonrpc: '2.0', 
                    id, 
                    result: {
                        content: [{ type: 'text', text: `SAP CAP Error: ${btpRes.error}` }],
                        isError: true,
                    }
                })
            }
            return send({ jsonrpc: '2.0', id, result: btpRes })
        } catch (e) {
            return send({ 
                jsonrpc: '2.0', 
                id, 
                result: {
                    content: [{ type: 'text', text: `Connection Error to BTP: ${e.message}` }],
                    isError: true,
                }
            })
        }
    }

    send({ jsonrpc: '2.0', id, error: { code: -32601, message: `Method '${method}' not supported.` } })
}

rl.on('line', line => {
    line = line.trim()
    if (!line) return
    let msg
    try { msg = JSON.parse(line) } catch { return }
    handle(msg).catch(e => process.stderr.write(e.message + '\n'))
})