"use client";

/**
 * Psixoloq — "Ödənişlər" (öz qazancı).
 *
 * Əvvəl psixoloq platformanın ondan tutduğu payı heç yerdə görmürdü; komissiya
 * yalnız Admin maliyyə səhifəsində vardı. Burada hər ödəniş üçün müştərinin
 * ödədiyi məbləğ, platformanın payı və psixoloqa qalan xalis məbləğ göstərilir.
 *
 * Səhifə YALNIZ @/components/ui kitindən qurulub (fanus-ui-kit qaydası).
 */

import { useCallback, useEffect, useState } from "react";
import { psychologistApi, type PsychologistEarnings, type PsychologistEarningRow } from "@/lib/api";
import {
  Card, CardHead, CardBody, DataTable, PageHead, PaymentStatus,
  SectionTitle, Stat, Stats, Status, type Column,
} from "@/components/ui";
import { azFormatDate } from "@/lib/datetime";
import { formatAzn } from "@/lib/money";

/** Faiz yoxdursa komissiya hesablanmır — bunu "0%" kimi göstərmək yanlış olardı. */
function pct(value: number | null) {
  return value == null ? "—" : `${value}%`;
}

export default function PsychologistPaymentsPage() {
  const [data, setData] = useState<PsychologistEarnings | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(false);
    psychologistApi.myEarnings()
      .then(setData)
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const columns: Column<PsychologistEarningRow>[] = [
    {
      key: "patient",
      header: "Müştəri",
      cell: r => (
        <div>
          <div>{r.patientName ?? "—"}</div>
          <Status tone="muted">
            {r.kind === "PACKAGE" ? (r.packageName ?? "Paket") : "Tək seans"}
          </Status>
        </div>
      ),
    },
    {
      key: "date",
      header: "Tarix",
      cell: r => azFormatDate(r.paidAt ?? r.createdAt),
      sortable: true,
      sortValue: r => r.paidAt ?? r.createdAt,
    },
    {
      key: "amount",
      header: "Müştəri ödəyib",
      numeric: true,
      sortable: true,
      sortValue: r => r.amount,
      cell: r => formatAzn(r.amount),
    },
    {
      key: "commission",
      header: "Platforma payı",
      numeric: true,
      cell: r => (
        <div>
          <div>{formatAzn(r.commissionAmount)}</div>
          <Status tone="muted">{pct(r.commissionPercent)}</Status>
        </div>
      ),
    },
    {
      key: "net",
      header: "Sizə qalan",
      numeric: true,
      sortable: true,
      sortValue: r => r.net,
      cell: r => formatAzn(r.net),
    },
    {
      key: "status",
      header: "Vəziyyət",
      cell: r => <PaymentStatus value={r.status} />,
      hideOnMobile: true,
    },
  ];

  return (
    <div>
      <PageHead
        title="Ödənişlər"
        sub="Müştərilərin ödədiyi məbləğ, platformanın tutduğu pay və sizə qalan xalis məbləğ."
      />

      <Stats>
        <Stat
          value={formatAzn(data?.grossTotal ?? 0)}
          label="Müştərilərin ödədiyi"
          meta="Yalnız təsdiqlənmiş ödənişlər"
        />
        <Stat
          value={formatAzn(data?.commissionTotal ?? 0)}
          label="Platforma payı"
          meta={`Cari faiz ${pct(data?.currentCommissionPercent ?? null)}`}
        />
        <Stat
          value={formatAzn(data?.netTotal ?? 0)}
          label="Sizə qalan"
          meta="Komissiya çıxıldıqdan sonra"
        />
        <Stat
          value={formatAzn(data?.balance ?? 0)}
          label="Ödənilməmiş qalıq"
          meta={`Artıq ödənilib: ${formatAzn(data?.paidOut ?? 0)}`}
        />
      </Stats>

      <Card>
        <CardHead title="Platforma payı necə hesablanır" />
        <CardBody>
          <p>
            Müştərinin ödədiyi qiymət dəyişmir — platforma payı yalnız sizə keçən
            məbləğdən tutulur. Faiz seansın necə yarandığından asılıdır.
          </p>
          <ul>
            <li>
              Müştəri sizi <b>özü seçəndə</b> tutulan pay{" "}
              {pct(data?.directCommissionPercent ?? null)}.
            </li>
            <li>
              Fanus sizi <b>təyin edəndə</b> tutulan pay{" "}
              {pct(data?.currentCommissionPercent ?? null)}.
            </li>
          </ul>
          <p>
            Faiz ödəniş təsdiqlənən anda möhürlənir — sonradan qayda dəyişsə,
            keçmiş ödənişlər toxunulmaz qalır.
          </p>
        </CardBody>
      </Card>

      <SectionTitle>Ödəniş sətirləri</SectionTitle>
      <DataTable
        rows={data?.rows ?? []}
        columns={columns}
        rowKey={r => r.paymentId}
        loading={loading}
        error={loadError ? "Ödənişlər yüklənmədi." : null}
        onRetry={load}
        empty={{
          title: "Hələ ödəniş yoxdur",
          body: "Seanslarınız ödənildikcə burada görünəcək.",
        }}
      />
    </div>
  );
}
