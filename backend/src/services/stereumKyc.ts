import { getEnv } from "../config/env.js";
import pino from "pino";

const logger = pino({ name: "stereum-kyc" });

const BASE_URL = "https://api.stereum.tech";

// ==================== TYPES ====================

export interface SegipValidateRequest {
  givenNames: string;
  surname1: string;
  surname2?: string | null;
  birthdate: string; // DD/MM/YYYY
  dniType: "CI" | "CE";
  documentNumber: string;
  complementNumber?: string | null;
}

export type SegipFieldStatus = "CORRECT" | "INCORRECT" | "NOT_VERIFIED";

export interface SegipValidateResponse {
  status: "VERIFIED" | "PARTIALLY_INCORRECT" | "OBSERVED_RECORD" | "NOT_FOUND";
  fields: Record<string, SegipFieldStatus> | null;
  validationId: number | null;
}

export interface CustomerCreateRequest {
  name: string;
  lastname: string;
  document_type: "CI" | "CE" | "PASSPORT";
  document_number: string;
  country: string;
  state_of_residence: string;
  economic_activity: string;
  source_of_funds: string;
  destination_of_funds: string;
  income_level: string;
  doc_provider_id?: string;
  idempotency_key: string;
}

export interface CustomerCreateResponse {
  id: string;
  name: string;
  lastname: string;
  country: string;
  document_type: string;
  document_number: string;
  state_of_residence: string;
  source_of_funds: string;
  destination_of_funds: string;
  contracted_services: string;
  income_level: string;
}

// ==================== SERVICE ====================

export class StereumKycService {
  private apiKey: string;

  constructor() {
    const env = getEnv();
    this.apiKey = env.STEREUM_API_KEY;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${BASE_URL}${path}`;
    const headers: Record<string, string> = {
      "x-api-key": this.apiKey,
      "Content-Type": "application/json",
    };

    logger.info({ method, path }, "Stereum KYC request");

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000),
    });

    const responseText = await response.text();

    if (!response.ok) {
      logger.error({ status: response.status, body: responseText }, "Stereum KYC API error");
      throw new Error(`Stereum KYC error: ${response.status} - ${responseText}`);
    }

    logger.info({ status: response.status }, "Stereum KYC API success");
    return JSON.parse(responseText) as T;
  }

  /**
   * Validate identity document against SEGIP (Bolivian national identity system)
   */
  async validateSegip(params: SegipValidateRequest): Promise<SegipValidateResponse> {
    return this.request<SegipValidateResponse>("POST", "/api/v1/segip/validate", params);
  }

  /**
   * Register customer in Stereum for compliance
   */
  async createCustomer(params: CustomerCreateRequest): Promise<CustomerCreateResponse> {
    return this.request<CustomerCreateResponse>("POST", "/api/v1/customers/create", params);
  }

  /**
   * Full KYC flow: validate SEGIP + create customer
   * Returns the Stereum customer ID on success
   */
  async completeKyc(params: {
    name: string;
    lastname: string;
    birthdate: string;
    documentType: "CI" | "CE";
    documentNumber: string;
    complementNumber?: string;
    stateOfResidence: string;
    economicActivity: string;
    sourceOfFunds: string;
    destinationOfFunds: string;
    incomeLevel: string;
    wallet: string;
  }): Promise<{ validated: boolean; customerId: string; segipStatus: string }> {
    // Step 1: Validate with SEGIP
    const segipResult = await this.validateSegip({
      givenNames: params.name.toUpperCase(),
      surname1: params.lastname.toUpperCase(),
      birthdate: params.birthdate,
      dniType: params.documentType,
      documentNumber: params.documentNumber,
      complementNumber: params.complementNumber || null,
    });

    if (segipResult.status !== "VERIFIED") {
      logger.warn({ status: segipResult.status, fields: segipResult.fields }, "SEGIP validation failed");
      return {
        validated: false,
        customerId: "",
        segipStatus: segipResult.status,
      };
    }

    // Step 2: Register customer in Stereum
    const customerResult = await this.createCustomer({
      name: params.name,
      lastname: params.lastname,
      document_type: params.documentType,
      document_number: params.documentNumber,
      country: "BO",
      state_of_residence: params.stateOfResidence,
      economic_activity: params.economicActivity,
      source_of_funds: params.sourceOfFunds,
      destination_of_funds: params.destinationOfFunds,
      income_level: params.incomeLevel,
      doc_provider_id: `SEIP-${segipResult.validationId || "000"}`,
      idempotency_key: params.wallet,
    });

    logger.info({ customerId: customerResult.id, wallet: params.wallet }, "Customer registered in Stereum");

    return {
      validated: true,
      customerId: customerResult.id,
      segipStatus: segipResult.status,
    };
  }
}
