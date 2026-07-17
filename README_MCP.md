# MCP Sales Order Server

This TypeScript MCP server exposes two tools for SAP Sales Order operations using the `API_SALES_ORDER_SRV` OData v2 service.

## Available tools

- `read_sales_order`
  - Retrieve a specific sales order by ID or list sales orders with optional `$filter`, `$top`, and `$skip`.
- `create_sales_order`
  - Create a new sales order header and deep insert line items using the `to_Item` navigation property.

## Setup

1. Copy the example environment file:

```bash
cp .env.example .env
```

2. Install dependencies:

```bash
npm install
```

3. Start the MCP server:

```bash
npm run start:mcp
```

## Environment variables

- `ODATA_BASE_URL` - Full base URL of the SAP OData service (without trailing slash)
- `ODATA_USERNAME` - Basic auth username for the SAP backend
- `ODATA_PASSWORD` - Basic auth password for the SAP backend

## Development

- `npm run build` - compile the TypeScript sources
- `npm run start:mcp` - run the MCP server with `ts-node`
