#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { GibworkAgentService, type GibworkAgentServiceOptions } from './service.js';
export declare const GIBWORK_MCP_TOOLS: Tool[];
export declare function executeMcpToolCall(service: GibworkAgentService, name: string, args?: Record<string, unknown>): Promise<{
    content: Array<{
        type: 'text';
        text: string;
    }>;
    isError?: boolean;
}>;
export declare function createGibworkMcpServer(options?: GibworkAgentServiceOptions): {
    server: Server;
    service: GibworkAgentService;
};
export declare function runStdioMcpServer(options?: GibworkAgentServiceOptions): Promise<void>;
//# sourceMappingURL=mcp.d.ts.map