import { Router, Request, Response } from "express";
import { z } from "zod";
import { StereumKycService } from "../services/stereumKyc.js";
import { apiLimiter } from "../middleware/rateLimit.js";
import { PrismaClient } from "@prisma/client";
import pino from "pino";

const logger = pino({ name: "kyc-route" });
const router = Router();
const prisma = new PrismaClient();

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

router.post("/validate", apiLimiter, async (req: Request, res: Response) => {
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

  try {
    const kycService = new StereumKycService();

    let result;

    // Mock mode for testing without active Stereum account
    if (process.env.STEREUM_MOCK_KYC === "true") {
      logger.info({ wallet: data.wallet }, "SEGIP validation using MOCK mode");
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
      result = await kycService.validateSegip({
        givenNames: data.name.toUpperCase(),
        surname1: data.lastname.toUpperCase(),
        birthdate: data.birthdate,
        dniType: data.documentType,
        documentNumber: data.documentNumber,
        complementNumber: data.complementNumber || null,
      });
    }

    await prisma.customer.upsert({
      where: { wallet: data.wallet },
      update: {
        name: data.name,
        lastname: data.lastname,
        documentType: data.documentType,
        documentNumber: data.documentNumber,
        complementNumber: data.complementNumber || null,
        kycStatus: result.status === "VERIFIED" ? "verified" : "rejected",
        kycValidatedAt: result.status === "VERIFIED" ? new Date() : null,
      },
      create: {
        wallet: data.wallet,
        name: data.name,
        lastname: data.lastname,
        documentType: data.documentType,
        documentNumber: data.documentNumber,
        complementNumber: data.complementNumber || null,
        stateOfResidence: "BO_S",
        kycStatus: result.status === "VERIFIED" ? "verified" : "rejected",
        kycValidatedAt: result.status === "VERIFIED" ? new Date() : null,
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
      error: error instanceof Error ? error.message : "SEGIP validation failed",
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
});

router.post("/register", apiLimiter, async (req: Request, res: Response) => {
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

  try {
    const existing = await prisma.customer.findUnique({
      where: { wallet: data.wallet },
    });

    if (existing?.kycStatus === "verified" && existing.stereumCustomerId) {
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

    // Mock mode
    if (process.env.STEREUM_MOCK_KYC === "true") {
      logger.info({ wallet: data.wallet }, "Customer registration using MOCK mode");
      result = {
        id: `MOCK-${Date.now()}`,
        name: data.name,
        lastname: data.lastname,
        country: "BO",
        document_type: data.documentType,
        document_number: data.documentNumber,
        state_of_residence: data.stateOfResidence,
        source_of_funds: data.sourceOfFunds,
        destination_of_funds: data.destinationOfFunds,
        contracted_services: "QR",
        income_level: data.incomeLevel,
      };
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
        income_level: data.incomeLevel,
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
      error: error instanceof Error ? error.message : "Customer registration failed",
      timestamp: new Date().toISOString(),
    });
  }
});

// ==================== CHECK KYC STATUS ====================

router.get("/status/:wallet", apiLimiter, async (req: Request, res: Response) => {
  const { wallet } = req.params;

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
