'use strict'
const cds = require('@sap/cds')

// Hook into CAP's bootstrapping phase
cds.on('bootstrap', (app) => {
    const express = require('express')
    app.use(express.json())

    try {
        // Resolve path to the compiled typescript file
        const mcpModule = require('./dist/index')
        
        if (!mcpModule || !mcpModule.mcpHandler) {
            throw new Error("mcpHandler was not found exported from dist/index.js");
        }

        app.post('/mcp/call', async (req, res) => {
            await mcpModule.mcpHandler(req, res)
        })
        
        console.log('[MCP SUCCESS] Exposing POST /mcp/call endpoint.')
    } catch (err) {
        console.error('[MCP FATAL ERROR] Could not bind the /mcp/call route!')
        console.error(err)
        // Crash the application immediately so BTP deployment fails rather than exposing a broken 404 endpoint
        process.exit(1)
    }
})

module.exports = cds.server