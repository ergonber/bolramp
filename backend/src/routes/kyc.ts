import { Router, Request, Response } from "express";
import { z } from "zod";
import { StereumKycService } from "../services/stereumKyc.js";
import { kycLimiter, kycResetLimiter } from "../middleware/rateLimit.js";
import { PrismaClient } from "@prisma/client";
import { normalizeWallet } from "../lib/wallet.js";
import { ethers } from "ethers";
import pino from "pino";

const logger = pino({ name: "kyc-route" });
const router = Router();
const prisma = new PrismaClient();

function mapIncomeLevelToFrontend(level: string): string {
  const map: Record<string, string> = {
    "Menos de $500": "0 - 500",
    "$500 - $1,000": "500 - 1000",
    "$1,000 - $2,000": "1000 - 2000",
    "$2,000 - $5,000": "2000 - 5000",
    "Mas de $5,000": "5000+",
  };
  return map[level] || level;
}

// ==================== VALIDATE SEGIP ====================

const segipSchema = z.object({
  wallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  name: z.string().min(1).max(100),
  lastname: z.string().min(1).max(100),
  birthdate: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/),
  documentType: z.enum(["CI", "CE"]),
  documentNumber: z.string().min(1).max(20),
  complementNumber: z.string().max(10).optional().nullable(),
});

router.post("/validate", kycLimiter, async (req: Request, res: Response) => {
  const parsed = segipSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: `Invalid request: ${parsed.error.issues.map(i => i.message).join(", ")}`,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const data = parsed.data;
  data.wallet = normalizeWallet(data.wallet);

  try {
    const kycService = new StereumKycService();

    let result;
    let customerId: string | null = null;

    if (process.env.STEREUM_MOCK_KYC === "true") {
      logger.info({ wallet: data.wallet }, "SEGIP validation using MOCK mode (skipped)");

      // Step 1: Still create customer in Stereum to get a real ID for quotes
      const existing = await prisma.customer.findUnique({ where: { wallet: data.wallet } });
      if (existing?.stereumCustomerId && !existing.stereumCustomerId.startsWith("MOCK-")) {
        customerId = existing.stereumCustomerId;
        logger.info({ wallet: data.wallet, customerId }, "Using existing Stereum customer ID");
      } else {
        const customerResult = await kycService.createCustomer({
          name: data.name,
          lastname: data.lastname,
          document_type: data.documentType,
          document_number: data.documentNumber,
          country: "BO",
          state_of_residence: "BO_S",
          economic_activity: "Otros",
          source_of_funds: "Ahorro personal",
          destination_of_funds: "Inversion",
          income_level: "1000 - 2000",
          doc_provider_id: "SEIP-003",
          idempotency_key: data.wallet,
        });
        customerId = customerResult.id;
        logger.info({ wallet: data.wallet, customerId }, "Customer created in Stereum (mock KYC)");
      }

      result = {
        status: "VERIFIED" as const,
        fields: {
          givenNames: "CORRECT" as const,
          surname1: "CORRECT" as const,
          birthdate: "CORRECT" as const,
          documentNumber: "CORRECT" as const,
        },
        validationId: 9999,
      };
    } else {
      // Step 1: Create customer first (Stereum requires active USDC account before SEGIP)
      const existing = await prisma.customer.findUnique({ where: { wallet: data.wallet } });

      if (existing?.stereumCustomerId && !existing.stereumCustomerId.startsWith("MOCK-")) {
        customerId = existing.stereumCustomerId;
        logger.info({ wallet: data.wallet, customerId }, "Customer already registered in Stereum");
      } else {
        const customerResult = await kycService.createCustomer({
          name: data.name,
          lastname: data.lastname,
          document_type: data.documentType,
          document_number: data.documentNumber,
          country: "BO",
          state_of_residence: "BO_S",
          economic_activity: "Otros",
          source_of_funds: "Ahorro personal",
          destination_of_funds: "Inversion",
          income_level: "1000 - 2000",
          doc_provider_id: "SEIP-003",
          idempotency_key: data.wallet,
        });
        customerId = customerResult.id;
        logger.info({ wallet: data.wallet, customerId }, "Customer created in Stereum");
      }

      // Step 2: Validate SEGIP (now that customer has an active USDC account)
      result = await kycService.validateSegip({
        givenNames: data.name.toUpperCase(),
        surname1: data.lastname.toUpperCase(),
        birthdate: data.birthdate,
        dniType: data.documentType,
        documentNumber: data.documentNumber,
        complementNumber: data.complementNumber || null,
      });
    }

    const isVerified = result.status === "VERIFIED";

    await prisma.customer.upsert({
      where: { wallet: data.wallet },
      update: {
        name: data.name,
        lastname: data.lastname,
        documentType: data.documentType,
        documentNumber: data.documentNumber,
        complementNumber: data.complementNumber || null,
        kycStatus: isVerified ? "verified" : "rejected",
        kycValidatedAt: isVerified ? new Date() : null,
        ...(customerId ? { stereumCustomerId: customerId } : {}),
      },
      create: {
        wallet: data.wallet,
        name: data.name,
        lastname: data.lastname,
        documentType: data.documentType,
        documentNumber: data.documentNumber,
        complementNumber: data.complementNumber || null,
        stateOfResidence: "BO_S",
        kycStatus: isVerified ? "verified" : "rejected",
        kycValidatedAt: isVerified ? new Date() : null,
        ...(customerId ? { stereumCustomerId: customerId } : {}),
      },
    });

    logger.info({ wallet: data.wallet, status: result.status }, "SEGIP validation completed");

    res.json({
      success: true,
      data: {
        status: result.status,
        fields: result.fields,
        validationId: result.validationId,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error({ error, wallet: data.wallet }, "SEGIP validation failed");
    res.status(500).json({
      success: false,
      error: process.env.NODE_ENV === "production" ? "SEGIP validation failed" : (error instanceof Error ? error.message : "SEGIP validation failed"),
      timestamp: new Date().toISOString(),
    });
  }
});

// ==================== REGISTER CUSTOMER ====================

const customerSchema = z.object({
  wallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  name: z.string().min(1).max(100),
  lastname: z.string().min(1).max(100),
  documentType: z.enum(["CI", "CE", "PASSPORT"]),
  documentNumber: z.string().min(1).max(20),
  stateOfResidence: z.string().min(2).max(5),
  economicActivity: z.string().min(1).max(200),
  sourceOfFunds: z.string().min(1).max(60),
  destinationOfFunds: z.string().min(1).max(60),
  incomeLevel: z.string().min(1).max(15),
  stereumCustomerId: z.string().optional(),
});

router.post("/register", kycLimiter, async (req: Request, res: Response) => {
  const parsed = customerSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: `Invalid request: ${parsed.error.issues.map(i => i.message).join(", ")}`,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const data = parsed.data;
  data.wallet = normalizeWallet(data.wallet);

  try {
    const existing = await prisma.customer.findUnique({
      where: { wallet: data.wallet },
    });

    const hasRealCustomerId = existing?.stereumCustomerId && !existing.stereumCustomerId.startsWith("MOCK-");

    if (existing?.kycStatus === "verified" && hasRealCustomerId) {
      res.json({
        success: true,
        data: {
          customerId: existing.stereumCustomerId,
          status: "already_registered",
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // If client provides an existing Stereum customer ID, just save it
    if (data.stereumCustomerId) {
      await prisma.customer.update({
        where: { wallet: data.wallet },
        data: { stereumCustomerId: data.stereumCustomerId },
      });
      logger.info({ wallet: data.wallet, customerId: data.stereumCustomerId }, "Existing Stereum customer linked");
      res.json({
        success: true,
        data: { customerId: data.stereumCustomerId, status: "linked" },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (existing?.kycStatus !== "verified") {
      res.status(400).json({
        success: false,
        error: "KYC not verified. Complete /validate first.",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const kycService = new StereumKycService();

    let result;

    // Mock mode — skip SEGIP but still create customer in Stereum
    if (process.env.STEREUM_MOCK_KYC === "true") {
      logger.info({ wallet: data.wallet }, "Customer registration using MOCK mode (skip SEGIP)");
      result = await kycService.createCustomer({
        name: data.name,
        lastname: data.lastname,
        document_type: data.documentType,
        document_number: data.documentNumber,
        country: "BO",
        state_of_residence: data.stateOfResidence,
        economic_activity: data.economicActivity,
        source_of_funds: data.sourceOfFunds,
        destination_of_funds: data.destinationOfFunds,
        income_level: mapIncomeLevelToFrontend(data.incomeLevel),
        doc_provider_id: "SEIP-003",
        idempotency_key: data.wallet,
      });
    } else {
      result = await kycService.createCustomer({
        name: data.name,
        lastname: data.lastname,
        document_type: data.documentType,
        document_number: data.documentNumber,
        country: "BO",
        state_of_residence: data.stateOfResidence,
        economic_activity: data.economicActivity,
        source_of_funds: data.sourceOfFunds,
        destination_of_funds: data.destinationOfFunds,
        income_level: mapIncomeLevelToFrontend(data.incomeLevel),
        idempotency_key: data.wallet,
      });
    }

    await prisma.customer.update({
      where: { wallet: data.wallet },
      data: {
        stereumCustomerId: result.id,
        economicActivity: data.economicActivity,
        sourceOfFunds: data.sourceOfFunds,
        destinationOfFunds: data.destinationOfFunds,
        incomeLevel: data.incomeLevel,
        stateOfResidence: data.stateOfResidence,
      },
    });

    logger.info({ wallet: data.wallet, customerId: result.id }, "Customer registered in Stereum");

    res.json({
      success: true,
      data: {
        customerId: result.id,
        status: "registered",
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error({ error, wallet: data.wallet }, "Customer registration failed");
    res.status(500).json({
      success: false,
      error: process.env.NODE_ENV === "production" ? "Customer registration failed" : (error instanceof Error ? error.message : "Customer registration failed"),
      timestamp: new Date().toISOString(),
    });
  }
});

// ==================== RESET KYC (for re-registration) ====================

const resetSchema = z.object({
  wallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  signature: z.string().regex(/^0x[a-f0-9]{130}$/),
  message: z.string().min(1),
});

router.post("/reset", kycResetLimiter, async (req: Request, res: Response) => {
  const parsed = resetSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: `Invalid request: ${parsed.error.issues.map(i => i.message).join(", ")}`,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const { signature, message } = parsed.data;
  const wallet = normalizeWallet(parsed.data.wallet);

  try {
    // Verify wallet ownership: the signature must be produced by the wallet
    // being reset, over the exact message provided.
    let recovered: string;
    try {
      recovered = ethers.verifyMessage(message, signature);
    } catch {
      res.status(400).json({
        success: false,
        error: "Invalid signature format",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (recovered.toLowerCase() !== wallet.toLowerCase()) {
      logger.warn({ wallet, recovered }, "KYC reset signature does not match wallet");
      res.status(403).json({
        success: false,
        error: "Signature does not match wallet",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // The signed message must reference the wallet to prevent a valid
    // signature over an unrelated message from being reused here.
    if (!message.toLowerCase().includes(wallet.toLowerCase())) {
      res.status(400).json({
        success: false,
        error: "Message must include the wallet address",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    logger.info({ wallet }, "KYC reset requested");

    const customer = await prisma.customer.findUnique({
      where: { wallet },
    });

    if (!customer) {
      res.status(404).json({
        success: false,
        error: "Customer not found",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    await prisma.customer.update({
      where: { wallet },
      data: {
        kycStatus: "pending",
        stereumCustomerId: null,
        kycValidatedAt: null,
      },
    });

    logger.info({ wallet }, "KYC reset completed");

    res.json({ success: true, message: "KYC reset. Please re-validate." });
  } catch (error) {
    logger.error({ error, wallet }, "KYC reset failed");
    res.status(500).json({
      success: false,
      error: "KYC reset failed",
      timestamp: new Date().toISOString(),
    });
  }
});

// ==================== CHECK KYC STATUS ====================

router.get("/status/:wallet", kycLimiter, async (req: Request, res: Response) => {
  const wallet = normalizeWallet(req.params.wallet);

  if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
    res.status(400).json({
      success: false,
      error: "Invalid wallet address",
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const customer = await prisma.customer.findUnique({
    where: { wallet },
    select: {
      kycStatus: true,
      stereumCustomerId: true,
      kycValidatedAt: true,
    },
  });

  res.json({
    success: true,
    data: {
      wallet,
      kycStatus: customer?.kycStatus || "not_started",
      hasCustomerId: !!customer?.stereumCustomerId,
      validatedAt: customer?.kycValidatedAt?.toISOString() || null,
    },
    timestamp: new Date().toISOString(),
  });
});

export default router;
