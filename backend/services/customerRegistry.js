import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const registryPath = join(__dirname, '../data/customers.json');

async function ensureRegistryFile() {
  try {
    await fs.access(registryPath);
  } catch {
    await fs.mkdir(join(__dirname, '../data'), { recursive: true });
    await fs.writeFile(registryPath, '[]\n', 'utf8');
  }
}

async function readRegistry() {
  await ensureRegistryFile();
  const raw = await fs.readFile(registryPath, 'utf8');
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeRegistry(customers) {
  await ensureRegistryFile();
  await fs.writeFile(registryPath, `${JSON.stringify(customers, null, 2)}\n`, 'utf8');
}

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function nowIso() {
  return new Date().toISOString();
}

export async function listCustomers() {
  const customers = await readRegistry();
  return customers.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
}

export async function getCustomer(customerId) {
  if (!customerId) return null;
  const customers = await readRegistry();
  return customers.find((c) => c.customerId === customerId) ?? null;
}

export async function upsertCustomer(input = {}) {
  const name = String(input.name || '').trim();
  const customerId = String(input.customerId || slugify(name)).trim();

  if (!customerId) {
    throw new Error('customerId or name is required');
  }

  const customers = await readRegistry();
  const index = customers.findIndex((c) => c.customerId === customerId);
  const timestamp = nowIso();

  const next = {
    customerId,
    name: name || customerId,
    role: String(input.role || '').trim(),
    company: String(input.company || '').trim(),
    email: String(input.email || '').trim(),
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  if (index >= 0) {
    const current = customers[index];
    customers[index] = {
      ...current,
      ...Object.fromEntries(
        Object.entries(next).filter(([key, value]) =>
          key === 'updatedAt' || key === 'customerId' || key === 'createdAt' || Boolean(value)
        )
      ),
      createdAt: current.createdAt || timestamp,
      updatedAt: timestamp,
    };
    await writeRegistry(customers);
    return customers[index];
  }

  customers.push(next);
  await writeRegistry(customers);
  return next;
}

export async function touchCustomer(customerId, defaults = {}) {
  if (!customerId) return null;
  const existing = await getCustomer(customerId);
  if (existing) return existing;

  return upsertCustomer({
    customerId,
    name: defaults.name || customerId,
    role: defaults.role || '',
    company: defaults.company || '',
    email: defaults.email || '',
  });
}

export async function deleteCustomer(customerId) {
  if (!customerId) return false;
  const customers = await readRegistry();
  const next = customers.filter((c) => c.customerId !== customerId);
  if (next.length === customers.length) {
    return false;
  }
  await writeRegistry(next);
  return true;
}
