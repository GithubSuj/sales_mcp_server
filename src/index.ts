import dotenv from "dotenv";
import { Request, Response } from "express";
import { ODataClient } from "./odataClient";

dotenv.config();

export async function mcpHandler(req: Request, res: Response) {
  const { tool, input } = req.body;

  try {
    const odata = await ODataClient.create();
    let result;

    if (tool === "read_sales_order") {
      if (input.salesOrderId) {
        const key = encodeURIComponent(input.salesOrderId);
        result = await odata.get(`/A_SalesOrder('${key}')`, { $expand: "to_Item" });
      } else {
        const params: Record<string, any> = { $expand: "to_Item" };
        if (input.filter) params.$filter = input.filter;
        if (input.top) params.$top = input.top;
        if (input.skip) params.$skip = input.skip;
        result = await odata.get("/A_SalesOrder", params);
      }
    } else if (tool === "create_sales_order") {
      const payload = { ...input, to_Item: input.to_Item };
      result = await odata.deepInsert("A_SalesOrder", payload);
    } else {
      return res.status(400).json({
        content: [{ type: "text", text: `Error: Unknown tool '${tool}'` }],
        isError: true
      });
    }

    return res.json({
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    });

  } catch (err: any) {
    return res.status(500).json({
      content: [{ type: "text", text: `Execution Failed: ${err.message}` }],
      isError: true
    });
  }
}