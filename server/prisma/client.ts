import { PrismaClient } from '@prisma/client';

declare global {
	// eslint-disable-next-line no-var
	// Using var on purpose so TypeScript allows re-declaration across HMR reloads
	var prisma: PrismaClient | undefined; // NOSONAR
}

export const prisma =
	global.prisma ??
	new PrismaClient({
		log: ['warn', 'error'], // add 'query' for verbose SQL logging if needed
	});

if (process.env.NODE_ENV !== 'production') global.prisma = prisma;
