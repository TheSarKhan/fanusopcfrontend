import { redirect } from "next/navigation";

/**
 * FAZA B2-1: the standalone "Seriyalar" page is gone — courses now live as
 * group cards inside /patient/appointments. The route stays as a redirect
 * because old notification and email links still point here.
 */
export default function PatientSeriesRedirect() {
  redirect("/patient/appointments");
}
