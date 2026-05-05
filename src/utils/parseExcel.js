import * as XLSX from 'xlsx'

/**
 * Parse uploaded Excel into normalized revenue + cost arrays.
 * Expected sheets: Revenue_2024_2025, Cost_2024_2025
 * Falls back to first/second sheet if names differ.
 */
export function parseExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' })

        const revSheetName =
          wb.SheetNames.find((n) => /revenue/i.test(n)) || wb.SheetNames[0]
        const costSheetName =
          wb.SheetNames.find((n) => /cost/i.test(n)) || wb.SheetNames[1]

        const revRaw = XLSX.utils.sheet_to_json(wb.Sheets[revSheetName])
        const costRaw = XLSX.utils.sheet_to_json(wb.Sheets[costSheetName])

        const revenue = revRaw.map((r) => ({
          year: Number(r.Year),
          month: r.Month,
          department: r.Department,
          fc1ServiceFees: num(r.FC1_ServiceFees),
          fc2ServiceFees: num(r.FC2_ServiceFees),
          actServiceFees: num(r.Actual_ServiceFees),
          fc1OtherIncome: num(r.FC1_OtherIncome),
          fc2OtherIncome: num(r.FC2_OtherIncome),
          actOtherIncome: num(r.Actual_OtherIncome),
          fc1Interest: num(r.FC1_Interest),
          fc2Interest: num(r.FC2_Interest),
          actInterest: num(r.Actual_Interest),
          fc1Tax: num(r.FC1_Tax),
          fc2Tax: num(r.FC2_Tax),
          actTax: num(r.Actual_Tax),
          comments: r.Comments || ''
        }))

        const cost = costRaw.map((r) => ({
          year: Number(r.Year),
          month: r.Month,
          department: r.Department,
          costType: r.Cost_Type,
          subCategory: r.Sub_Category,
          fc1: num(r.FC1),
          fc2: num(r.FC2),
          actual: num(r.Actual),
          comments: r.Comments || ''
        }))

        resolve({ revenue, cost })
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

const num = (v) => (v == null || v === '' ? 0 : Number(v))
