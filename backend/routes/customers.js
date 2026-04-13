import { Router } from 'express';
import { deleteCustomer, getCustomer, listCustomers, upsertCustomer } from '../services/customerRegistry.js';

export const customersRouter = Router();

customersRouter.get('/', async (_req, res) => {
  try {
    const customers = await listCustomers();
    return res.json({ customers });
  } catch (err) {
    console.error('[Customers] list failed:', err.message);
    return res.status(500).json({ error: 'Failed to list customers' });
  }
});

customersRouter.post('/', async (req, res) => {
  const { customerId, name, role, company, email } = req.body || {};

  if (!customerId && (!name || typeof name !== 'string')) {
    return res.status(400).json({ error: 'name or customerId is required' });
  }

  try {
    const customer = await upsertCustomer({ customerId, name, role, company, email });
    return res.status(201).json({ customer });
  } catch (err) {
    console.error('[Customers] create failed:', err.message);
    return res.status(500).json({ error: 'Failed to create customer' });
  }
});

customersRouter.patch('/:id', async (req, res) => {
  const customerId = String(req.params.id || '').trim();
  if (!customerId) {
    return res.status(400).json({ error: 'customer id is required' });
  }

  const existing = await getCustomer(customerId);
  if (!existing) {
    return res.status(404).json({ error: 'Customer not found' });
  }

  const { name, role, company, email } = req.body || {};
  try {
    const customer = await upsertCustomer({ customerId, name, role, company, email });
    return res.json({ customer });
  } catch (err) {
    console.error('[Customers] update failed:', err.message);
    return res.status(500).json({ error: 'Failed to update customer' });
  }
});

customersRouter.delete('/:id', async (req, res) => {
  const customerId = String(req.params.id || '').trim();
  if (!customerId) {
    return res.status(400).json({ error: 'customer id is required' });
  }

  try {
    const removed = await deleteCustomer(customerId);
    if (!removed) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    return res.status(204).send();
  } catch (err) {
    console.error('[Customers] delete failed:', err.message);
    return res.status(500).json({ error: 'Failed to delete customer' });
  }
});
