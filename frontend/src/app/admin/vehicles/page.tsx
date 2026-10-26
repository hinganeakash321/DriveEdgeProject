"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { FilterOptions } from "@/lib/types";
import { LoadingBlock, FadeIn } from "@/components/ui";
import { DataTable } from "@/components/data-table";
import { useToast } from "@/components/toast";

interface AdminModel {
  id: number;
  model_name: string;
  manufacturer_name?: string;
  body_type: string;
  status: string;
  active: boolean;
  variant_count: number;
  has_image: boolean;
}

const FUELS = ["petrol", "diesel", "cng", "electric", "hybrid"];
const TRANSMISSIONS = ["manual", "automatic", "amt", "cvt", "dct"];
const STATUSES = ["available", "upcoming", "discontinued"];

export default function AdminVehiclesPage() {
  const [opts, setOpts] = useState<FilterOptions | null>(null);
  const [models, setModels] = useState<AdminModel[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const toast = useToast();

  // new model form
  const [mModel, setMModel] = useState({ manufacturer_id: "", model_name: "", slug: "", body_type: "SUV", image_url: "" });
  // new variant form
  const [mVariant, setMVariant] = useState({ vehicle_model_id: "", variant_name: "", fuel_type: "petrol", transmission: "manual", ex_showroom_price: "", mileage: "", power: "", seating_capacity: "" });

  const loadModels = () => api.get<AdminModel[]>("/api/admin/models").then(setModels).catch(() => setModels([]));

  useEffect(() => {
    api.get<FilterOptions>("/api/cars/filters").then(setOpts).catch(() => {});
    loadModels();
  }, []);

  const toggleActive = async (m: AdminModel) => {
    await api.patch(`/api/admin/models/${m.id}`, { active: !m.active });
    loadModels();
  };
  const setStatus = async (m: AdminModel, status: string) => {
    await api.patch(`/api/admin/models/${m.id}`, { status });
    loadModels();
  };

  const addModel = async () => {
    setMsg(null);
    try {
      await api.post("/api/admin/models", {
        manufacturer_id: Number(mModel.manufacturer_id),
        model_name: mModel.model_name,
        slug: mModel.slug,
        body_type: mModel.body_type,
        image_url: mModel.image_url || null,
      });
      setMModel({ manufacturer_id: "", model_name: "", slug: "", body_type: "SUV", image_url: "" });
      setMsg("Model created.");
      toast.success("Model created", mModel.model_name);
      loadModels();
    } catch {
      setMsg("Could not create model (slug may already exist).");
      toast.error("Could not create model", "The slug may already exist.");
    }
  };

  const addVariant = async () => {
    setMsg(null);
    try {
      await api.post("/api/admin/variants", {
        vehicle_model_id: Number(mVariant.vehicle_model_id),
        variant_name: mVariant.variant_name,
        fuel_type: mVariant.fuel_type,
        transmission: mVariant.transmission,
        ex_showroom_price: mVariant.ex_showroom_price ? Number(mVariant.ex_showroom_price) : null,
        mileage: mVariant.mileage || null,
        power: mVariant.power || null,
        seating_capacity: mVariant.seating_capacity ? Number(mVariant.seating_capacity) : null,
      });
      setMVariant({ ...mVariant, variant_name: "", ex_showroom_price: "", mileage: "", power: "", seating_capacity: "" });
      setMsg("Variant created.");
      toast.success("Variant created");
      loadModels();
    } catch {
      setMsg("Could not create variant.");
      toast.error("Could not create variant");
    }
  };

  return (
    <div>
      <FadeIn>
        <h1 className="text-2xl font-bold text-navy">Catalogue Management</h1>
        <p className="mt-1 text-muted">Create and curate models and variants. Changes are recorded in the audit log.</p>
      </FadeIn>
      {msg && <p className="mt-3 text-sm text-brand" role="status">{msg}</p>}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-3 text-sm font-semibold text-ink">Add model</h2>
          <div className="grid gap-3">
            <select className="input" value={mModel.manufacturer_id} onChange={(e) => setMModel({ ...mModel, manufacturer_id: e.target.value })}>
              <option value="">Select manufacturer</option>
              {opts?.manufacturers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <input className="input" placeholder="Model name" value={mModel.model_name} onChange={(e) => setMModel({ ...mModel, model_name: e.target.value })} />
            <input className="input" placeholder="Slug (e.g. tata-nexon)" value={mModel.slug} onChange={(e) => setMModel({ ...mModel, slug: e.target.value })} />
            <input className="input" placeholder="Body type (SUV, Hatchback…)" value={mModel.body_type} onChange={(e) => setMModel({ ...mModel, body_type: e.target.value })} />
            <input className="input" placeholder="Image URL (optional)" value={mModel.image_url} onChange={(e) => setMModel({ ...mModel, image_url: e.target.value })} />
            <button className="btn-gradient" onClick={addModel}>Create model</button>
          </div>
        </div>

        <div className="card p-5">
          <h2 className="mb-3 text-sm font-semibold text-ink">Add variant</h2>
          <div className="grid gap-3">
            <select className="input" value={mVariant.vehicle_model_id} onChange={(e) => setMVariant({ ...mVariant, vehicle_model_id: e.target.value })}>
              <option value="">Select model</option>
              {models?.map((m) => <option key={m.id} value={m.id}>{m.manufacturer_name} {m.model_name}</option>)}
            </select>
            <input className="input" placeholder="Variant name" value={mVariant.variant_name} onChange={(e) => setMVariant({ ...mVariant, variant_name: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <select className="input" value={mVariant.fuel_type} onChange={(e) => setMVariant({ ...mVariant, fuel_type: e.target.value })}>
                {FUELS.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
              <select className="input" value={mVariant.transmission} onChange={(e) => setMVariant({ ...mVariant, transmission: e.target.value })}>
                {TRANSMISSIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <input className="input" placeholder="Ex-showroom price (₹)" value={mVariant.ex_showroom_price} onChange={(e) => setMVariant({ ...mVariant, ex_showroom_price: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <input className="input" placeholder="Mileage (e.g. 18 kmpl)" value={mVariant.mileage} onChange={(e) => setMVariant({ ...mVariant, mileage: e.target.value })} />
              <input className="input" placeholder="Seating" value={mVariant.seating_capacity} onChange={(e) => setMVariant({ ...mVariant, seating_capacity: e.target.value })} />
            </div>
            <button className="btn-gradient" onClick={addVariant}>Create variant</button>
          </div>
        </div>
      </div>

      <h2 className="mt-8 text-lg font-semibold text-navy">Models ({models?.length ?? 0})</h2>
      {!models ? (
        <LoadingBlock />
      ) : (
        <DataTable
          className="mt-3"
          minWidthClass="min-w-[720px]"
          rows={models}
          rowKey={(m) => m.id}
          mobileTitle={(m) => `${m.manufacturer_name ?? ""} ${m.model_name}`.trim()}
          columns={[
            { key: "model", header: "Model", cell: (m) => <span className="font-medium text-ink">{m.manufacturer_name} {m.model_name}</span> },
            { key: "body", header: "Body", cell: (m) => <span className="text-muted">{m.body_type}</span> },
            { key: "variants", header: "Variants", cell: (m) => <span className="text-ink">{m.variant_count}</span> },
            { key: "image", header: "Image", cell: (m) => (m.has_image ? <span className="text-success">✓</span> : <span className="text-muted">—</span>) },
            {
              key: "status",
              header: "Status",
              cell: (m) => (
                <select className="input w-auto py-1 text-xs" value={m.status} onChange={(e) => setStatus(m, e.target.value)}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              ),
            },
            {
              key: "active",
              header: "Active",
              cell: (m) => (
                <button className="btn-outline text-xs" onClick={() => toggleActive(m)}>{m.active ? "Active" : "Inactive"}</button>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
