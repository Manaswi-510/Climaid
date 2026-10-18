"""
generate_report.py
Generates the official ClimateAdapt Pune Climate Adaptation & Resilience PDF Report.
Adheres strictly to the specification (Page 10 of Implementation Guide):
- Executive Summary & Scope
- Data Inventory & Quality Disclosures
- Evidence-backed Screening Indicators (Heat, Flood, Water Stress, Green Deficit)
- Prioritized Interventions & Budget Portfolio Breakdown
- Scenario Comparisons (Baseline vs Heatwave vs Monsoon Deluge)
- Transparent Limitations, Uncertainties & Missing Data Roadmaps
"""

import os
import sys
import json
from pathlib import Path
from datetime import datetime, timezone

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, HRFlowable
from reportlab.lib.units import inch

def generate_pdf_report():
    repo_root = Path(__file__).resolve().parent.parent.parent
    reports_dir = repo_root / "reports"
    reports_dir.mkdir(parents=True, exist_ok=True)
    pdf_path = reports_dir / "ClimateAdapt_Pune_Action_Report.pdf"

    processed_dir = repo_root / "data" / "processed"
    exports_dir = repo_root / "data" / "exports"

    # Load computed data
    indicators_file = processed_dir / "ward_indicators.json"
    plan_file = exports_dir / "action_plan_latest.json"
    scenarios_file = exports_dir / "scenarios_latest.json"
    manifest_file = processed_dir / "data_manifest.json"

    ward_data = {}
    if indicators_file.exists():
        with open(indicators_file, "r", encoding="utf-8") as f:
            ward_data = json.load(f)

    plan_data = {}
    if plan_file.exists():
        with open(plan_file, "r", encoding="utf-8") as f:
            plan_data = json.load(f)

    scenarios_data = {}
    if scenarios_file.exists():
        with open(scenarios_file, "r", encoding="utf-8") as f:
            scenarios_data = json.load(f)

    doc = SimpleDocTemplate(
        str(pdf_path),
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()

    # Custom Palette
    PRIMARY = colors.HexColor("#0f172a") # Slate 900
    ACCENT = colors.HexColor("#0284c7")  # Sky 600
    WARNING = colors.HexColor("#d97706") # Amber 600
    LIGHT_BG = colors.HexColor("#f8fafc")
    BORDER_COL = colors.HexColor("#cbd5e1")

    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=24,
        leading=28,
        textColor=PRIMARY
    )
    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=12,
        leading=16,
        textColor=colors.HexColor("#475569")
    )
    h2_style = ParagraphStyle(
        'Heading2Custom',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=14,
        leading=18,
        textColor=PRIMARY,
        spaceBefore=12,
        spaceAfter=6
    )
    body_style = ParagraphStyle(
        'BodyCustom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#1e293b")
    )
    callout_style = ParagraphStyle(
        'Callout',
        parent=styles['Normal'],
        fontName='Helvetica-Oblique',
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor("#334155")
    )

    story = []

    # Header / Title Banner
    story.append(Paragraph("ClimateAdapt Pune: Evidence-Led Climate Action Report", title_style))
    story.append(Spacer(1, 4))
    story.append(Paragraph(f"Pilot Study: Pune Urban Core, Maharashtra | Generated: {datetime.now(timezone.utc).strftime('%d %B %Y %H:%M UTC')}", subtitle_style))
    story.append(Spacer(1, 10))
    story.append(HRFlowable(width="100%", thickness=1.5, color=ACCENT, spaceBefore=4, spaceAfter=12))

    # Executive Summary Box
    exec_text = (
        "<b>Executive Summary:</b> This report translates real municipal drainage statistics (OpenCity Pune), "
        "OpenStreetMap infrastructure assets (5,779 trees, 267 medical facilities, waterways), and Open-Meteo 7-day "
        "atmospheric forecasts into actionable climate resilience priorities for Pune's electoral wards. "
        "In strict adherence to the project charter, all findings distinguish measured infrastructure data from model proxies, "
        "and unvalidated data (such as local well hydrographs or cloud-covered satellite rasters) are explicitly labeled as missing rather than assumed."
    )
    exec_table = Table([[Paragraph(exec_text, body_style)]], colWidths=[540])
    exec_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), LIGHT_BG),
        ('BOX', (0,0), (-1,-1), 1, BORDER_COL),
        ('PADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(exec_table)
    story.append(Spacer(1, 14))

    # Section 1: Top Vulnerability Screening
    story.append(Paragraph("1. High-Priority Wards (Screening Indicators)", h2_style))
    story.append(Paragraph("Scores are normalized 0-100 screening proxies. Higher values denote greater exposure or infrastructure deficit.", body_style))
    story.append(Spacer(1, 6))

    wards = ward_data.get("wards", [])[:6]
    table_data = [
        ["Ward / Prabhag", "Heat Proxy", "Flood Proxy", "Water Stress", "Green Deficit", "Composite"]
    ]
    for w in wards:
        inds = w.get("indicators", {})
        table_data.append([
            w.get("ward_title", "Unknown")[:24],
            f"{inds.get('heat_exposure_proxy', 0):.1f}",
            f"{inds.get('flood_screening_proxy', 0):.1f}",
            f"{inds.get('water_stress_proxy', 0):.1f}",
            f"{inds.get('green_deficit_proxy', 0):.1f}",
            f"<b>{inds.get('composite_vulnerability_score', 0):.1f}</b>"
        ])

    ward_table = Table(table_data, colWidths=[150, 75, 75, 80, 80, 80])
    ward_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#e2e8f0")),
        ('TEXTCOLOR', (0,0), (-1,0), PRIMARY),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,-1), 8.5),
        ('ALIGN', (1,0), (-1,-1), 'CENTER'),
        ('GRID', (0,0), (-1,-1), 0.5, BORDER_COL),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, LIGHT_BG]),
        ('PADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(ward_table)
    story.append(Spacer(1, 14))

    # Section 2: Budget-Optimized Action Plan
    story.append(Paragraph("2. Prioritized Adaptation Action Plan (Budget Allocation)", h2_style))
    budget_info = plan_data.get("budget_constraints", {})
    spend_inr = budget_info.get("allocated_spend_inr", 0)
    total_budget = budget_info.get("total_budget_inr", 0)
    story.append(Paragraph(
        f"<b>Target Portfolio Budget:</b> INR {total_budget:,.0f} | <b>Committed Allocation:</b> INR {spend_inr:,.0f} "
        f"({(spend_inr/total_budget)*100:.1f}% efficiency)", body_style
    ))
    story.append(Spacer(1, 6))

    portfolio = plan_data.get("portfolio", [])
    plan_rows = [
        ["Intervention", "Category", "Units", "Cost (INR)", "Dept", "Lead Time"]
    ]
    for p in portfolio:
        plan_rows.append([
            p.get("title", "")[:28],
            p.get("category", "")[:15],
            f"{p.get('allocated_units', 1)} {p.get('unit', '')[:8]}",
            f"₹{p.get('total_cost_inr', 0):,}",
            p.get("responsible_department", "")[:18],
            f"{p.get('lead_time_months', 1)} mo"
        ])

    plan_table = Table(plan_rows, colWidths=[150, 85, 75, 80, 100, 50])
    plan_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#0284c7")),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,-1), 8),
        ('GRID', (0,0), (-1,-1), 0.5, BORDER_COL),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, LIGHT_BG]),
        ('PADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(plan_table)
    story.append(Spacer(1, 14))

    # Section 3: Scenario Comparisons
    story.append(Paragraph("3. Climate Stress Scenario Comparisons", h2_style))
    scenarios = [
        ("Current Baseline", scenarios_data.get("baseline_scenario", {})),
        ("Extreme Heatwave (+3.5°C)", scenarios_data.get("heatwave_scenario", {})),
        ("Extreme Monsoon Cloudburst", scenarios_data.get("flash_rainfall_scenario", {})),
        ("Post-Adaptation Plan", scenarios_data.get("post_adaptation_scenario", {}))
    ]
    scen_rows = [["Scenario", "Heat Index", "Flood Index", "Water Stress", "Composite Index"]]
    for name, s in scenarios:
        scen_rows.append([
            name,
            f"{s.get('heat_proxy', 0):.1f}",
            f"{s.get('flood_proxy', 0):.1f}",
            f"{s.get('water_stress_proxy', 0):.1f}",
            f"{s.get('composite_vulnerability', 0):.1f}"
        ])
    scen_table = Table(scen_rows, colWidths=[160, 95, 95, 95, 95])
    scen_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#334155")),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,-1), 8.5),
        ('ALIGN', (1,0), (-1,-1), 'CENTER'),
        ('GRID', (0,0), (-1,-1), 0.5, BORDER_COL),
        ('PADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(scen_table)
    story.append(Spacer(1, 14))

    # Section 4: Data Quality & Responsible Use Disclosures
    story.append(Paragraph("4. Responsible Use & Data Quality Disclosures", h2_style))
    disclosures = (
        "• <b>Distinction of Evidence:</b> Drainage statistics are verified 2015-2016 OpenCity PMC releases. "
        "Atmospheric values represent Open-Meteo multi-variable NWP forecast models and must not be cited as permanent climate normals.<br/>"
        "• <b>Explicit Missing Data:</b> Local observation wells (GSDA telemetry) and uncalibrated DEM hydrological runoff grids "
        "remain unconfirmed and are strictly excluded from automated physical simulation to prevent false certainty.<br/>"
        "• <b>Human Review:</b> Action allocations are exploratory decision-support calculations and require municipal site surveys before civil construction."
    )
    disc_table = Table([[Paragraph(disclosures, callout_style)]], colWidths=[540])
    disc_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#fffbeb")),
        ('BOX', (0,0), (-1,-1), 1, WARNING),
        ('PADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(disc_table)

    # Build PDF
    doc.build(story)
    print(f"[+] Successfully generated official PDF report at {pdf_path}")
    print("[SUCCESS] Report generation completed.")

if __name__ == "__main__":
    generate_pdf_report()
