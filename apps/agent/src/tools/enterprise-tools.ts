import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { WafClient } from '../waf-client';

/**
 * Enterprise Tool Definitions
 *
 * These are the tools the LangGraph agent can request.
 * EVERY tool call is routed through WafClient — the agent
 * cannot bypass the WAF under any circumstances.
 */
export function createWafBoundTools(wafClient: WafClient) {
  const searchCustomer = tool(
    async ({ query }) => {
      const result = await wafClient.callTool('search_customer', { query });
      return JSON.stringify(result);
    },
    {
      name: 'search_customer',
      description: 'Search for customers by name, email, or ID',
      schema: z.object({
        query: z.string().describe('Search query string'),
      }),
    }
  );

  const getCustomer = tool(
    async ({ customer_id }) => {
      const result = await wafClient.callTool('get_customer', { customer_id });
      return JSON.stringify(result);
    },
    {
      name: 'get_customer',
      description: 'Get a specific customer by their ID',
      schema: z.object({
        customer_id: z.string().describe('The customer ID (e.g. C101)'),
      }),
    }
  );

  const updateCustomer = tool(
    async ({ customer_id, updates }) => {
      const result = await wafClient.callTool('update_customer', { customer_id, ...updates });
      return JSON.stringify(result);
    },
    {
      name: 'update_customer',
      description: 'Update customer details. Requires get_customer to be called first.',
      schema: z.object({
        customer_id: z.string().describe('The customer ID'),
        updates: z.record(z.string()).describe('Fields to update'),
      }),
    }
  );

  const deleteCustomer = tool(
    async ({ customer_id }) => {
      const result = await wafClient.callTool('delete_customer', { customer_id });
      return JSON.stringify(result);
    },
    {
      name: 'delete_customer',
      description: 'Permanently delete a customer record',
      schema: z.object({
        customer_id: z.string().describe('The customer ID to delete'),
      }),
    }
  );

  const sendEmail = tool(
    async ({ to, subject, body }) => {
      const result = await wafClient.callTool('send_email', { to, subject, body });
      return JSON.stringify(result);
    },
    {
      name: 'send_email',
      description: 'Send an email to a customer',
      schema: z.object({
        to: z.string().describe('Recipient email address'),
        subject: z.string().describe('Email subject line'),
        body: z.string().describe('Email body content'),
      }),
    }
  );

  const transferMoney = tool(
    async ({ customer_id, amount, recipient }) => {
      const result = await wafClient.callTool('transfer_money', { customer_id, amount, recipient });
      return JSON.stringify(result);
    },
    {
      name: 'transfer_money',
      description: 'Initiate a financial transfer for a customer',
      schema: z.object({
        customer_id: z.string().describe('Customer ID authorising the transfer'),
        amount: z.number().describe('Transfer amount in INR'),
        recipient: z.string().describe('Recipient account or name'),
      }),
    }
  );

  return [searchCustomer, getCustomer, updateCustomer, deleteCustomer, sendEmail, transferMoney];
}
