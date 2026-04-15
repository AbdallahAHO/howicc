import type { AstroGlobal } from 'astro'
import { requireUser } from './server'

export const requireAuthenticatedPage = (astro: AstroGlobal) => requireUser(astro)
