// D:\PVEB\backend\src\routes\customers.ts

import { Router, Request, Response } from "express";
import { authenticate, authorize } from "../middleware/auth";

const router = Router();

/**
 * GET /api/customers
 * List customers (temporary dummy implementation)
 */
router.get(
  "/",
  authenticate,
  authorize("ADMIN", "MANAGER", "STAFF"),
  async (req: Request, res: Response) => {
    try {
      // TODO: Replace with real DB query
      const customers = [
        {
          id: "c1",
          name: "Demo Customer",
          email: "customer@example.com",
          phone: "9999999999",
          currentBalance: 0,
        },
      ];

      return res.json({
        success: true,
        customers,
      });
    } catch (err) {
      console.error("GET /customers error:", err);
      return res.status(500).json({ success: false, error: "Failed to fetch customers" });
    }
  }
);

/**
 * GET /api/customers/:id
 */
router.get(
  "/:id",
  authenticate,
  authorize("ADMIN", "MANAGER", "STAFF"),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      // TODO: Replace with real DB query
      const customer = {
        id,
        name: "Demo Customer",
        email: "customer@example.com",
        phone: "9999999999",
        currentBalance: 0,
      };

      return res.json({ success: true, customer });
    } catch (err) {
      console.error("GET /customers/:id error:", err);
      return res.status(500).json({ success: false, error: "Failed to fetch customer" });
    }
  }
);

/**
 * POST /api/customers
 */
router.post(
  "/",
  authenticate,
  authorize("ADMIN", "MANAGER"),
  async (req: Request, res: Response) => {
    try {
      const { name, email, phone } = req.body;

      if (!name) {
        return res.status(400).json({ success: false, error: "Name is required" });
      }

      // TODO: Insert into DB and return created record
      const created = {
        id: "new-id",
        name,
        email: email || null,
        phone: phone || null,
        currentBalance: 0,
      };

      return res.status(201).json({ success: true, customer: created });
    } catch (err) {
      console.error("POST /customers error:", err);
      return res.status(500).json({ success: false, error: "Failed to create customer" });
    }
  }
);

/**
 * PUT /api/customers/:id
 */
router.put(
  "/:id",
  authenticate,
  authorize("ADMIN", "MANAGER"),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { name, email, phone } = req.body;

      // TODO: Update in DB and return updated record
      const updated = {
        id,
        name: name || "Updated Customer",
        email: email || "customer@example.com",
        phone: phone || "9999999999",
        currentBalance: 0,
      };

      return res.json({ success: true, customer: updated });
    } catch (err) {
      console.error("PUT /customers/:id error:", err);
      return res.status(500).json({ success: false, error: "Failed to update customer" });
    }
  }
);

/**
 * DELETE /api/customers/:id
 */
router.delete(
  "/:id",
  authenticate,
  authorize("ADMIN", "MANAGER"),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      // TODO: Delete from DB
      console.log("Delete customer", id);

      return res.json({ success: true });
    } catch (err) {
      console.error("DELETE /customers/:id error:", err);
      return res.status(500).json({ success: false, error: "Failed to delete customer" });
    }
  }
);

export default router;
