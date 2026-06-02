/**
 * Reports & Analytics Module - js/reports.js
 * Generates custom analytics summaries and paints high-definition Pie, Bar, and Line charts using the HTML5 Canvas API.
 */
import { storage } from "./storage.js";
import { loans as loanMgr } from "./loans.js";

class ReportManager {
  // Compute basic reports data
  async getSummary(year = new Date().getFullYear(), month = new Date().getMonth()) {
    const transactions = await storage.read("transactions") || [];
    const activeLoans = await storage.read("loans") || [];

    // Filter by year & month if provided
    const filteredTxs = transactions.filter(t => {
      const d = new Date(t.date);
      return d.getFullYear() === year && (month === null || d.getMonth() === month);
    });

    const income = filteredTxs.filter(t => t.type === "Income").reduce((s, t) => s + Number(t.amount), 0);
    const expenses = filteredTxs.filter(t => t.type === "Expense").reduce((s, t) => s + Number(t.amount), 0);

    const totalLoansGiven = activeLoans.filter(l => l.loanType === "Given").reduce((s, l) => s + loanMgr.getRemainingBalance(l), 0);
    const totalLoansTaken = activeLoans.filter(l => l.loanType === "Taken").reduce((s, l) => s + loanMgr.getRemainingBalance(l), 0);

    return {
      income,
      expenses,
      savings: Math.max(0, income - expenses),
      loansGiven: totalLoansGiven,
      loansTaken: totalLoansTaken
    };
  }

  // Draw Pie Chart
  drawPieChart(canvasId, data, colors) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    
    // Scale for retina
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    ctx.clearRect(0, 0, width, height);

    const total = data.reduce((sum, item) => sum + item.value, 0);
    if (total === 0) {
      ctx.fillStyle = "#888";
      ctx.font = "14px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("No data available", width / 2, height / 2);
      return;
    }

    const centerX = width / 3;
    const centerY = height / 2;
    const radius = Math.min(centerX, centerY) - 20;

    let startAngle = -Math.PI / 2;

    data.forEach((item, index) => {
      const sliceAngle = (item.value / total) * 2 * Math.PI;
      const color = colors[index % colors.length];

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
      ctx.closePath();

      ctx.fillStyle = color;
      ctx.fill();

      // Shadow overlay for depth
      ctx.fillStyle = "rgba(0,0,0,0.05)";
      ctx.fill();

      startAngle += sliceAngle;
    });

    // Draw Legends on the right side
    const legendX = (width / 3) * 2 - 10;
    let legendY = 30;
    
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.font = "12px Inter, sans-serif";

    data.forEach((item, index) => {
      const color = colors[index % colors.length];
      
      // Draw Color Block
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(legendX, legendY, 6, 0, 2 * Math.PI);
      ctx.fill();

      // Draw Label
      const percentage = Math.round((item.value / total) * 100);
      ctx.fillStyle = document.documentElement.getAttribute("data-theme") === "dark" ? "#e2e8f0" : "#1e293b";
      ctx.fillText(`${item.label} (${percentage}%)`, legendX + 15, legendY);
      
      legendY += 24;
    });
  }

  // Draw Bar Chart
  drawBarChart(canvasId, labels, datasets, colors) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    ctx.clearRect(0, 0, width, height);

    const padding = { top: 20, right: 20, bottom: 40, left: 50 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Find max value in datasets to scale Y-axis
    let maxValue = 100;
    datasets.forEach(ds => {
      const datasetMax = Math.max(...ds.data, 0);
      if (datasetMax > maxValue) maxValue = datasetMax * 1.1;
    });

    // Y Axis Grid lines
    const gridLines = 5;
    ctx.strokeStyle = document.documentElement.getAttribute("data-theme") === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)";
    ctx.fillStyle = document.documentElement.getAttribute("data-theme") === "dark" ? "#94a3b8" : "#64748b";
    ctx.font = "10px Inter, sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    for (let i = 0; i <= gridLines; i++) {
      const yVal = (maxValue / gridLines) * i;
      const yPos = padding.top + chartHeight - (yVal / maxValue) * chartHeight;
      
      ctx.beginPath();
      ctx.moveTo(padding.left, yPos);
      ctx.lineTo(padding.left + chartWidth, yPos);
      ctx.stroke();

      ctx.fillText(Math.round(yVal).toLocaleString(), padding.left - 8, yPos);
    }

    // X Axis Labels and Bar Rendering
    const numGroups = labels.length;
    const groupWidth = chartWidth / numGroups;
    const numBarsPerGroup = datasets.length;
    const barWidth = (groupWidth * 0.6) / numBarsPerGroup;

    labels.forEach((label, groupIdx) => {
      const groupCenterX = padding.left + groupIdx * groupWidth + groupWidth / 2;

      datasets.forEach((ds, dsIdx) => {
        const value = ds.data[groupIdx] || 0;
        const barHeight = (value / maxValue) * chartHeight;
        const barX = groupCenterX - (barWidth * numBarsPerGroup) / 2 + dsIdx * barWidth;
        const barY = padding.top + chartHeight - barHeight;

        ctx.fillStyle = colors[dsIdx % colors.length];
        
        // Draw round corner top bars
        ctx.beginPath();
        ctx.roundRect(barX, barY, barWidth - 4, barHeight, [4, 4, 0, 0]);
        ctx.fill();
      });

      // Draw Group Label
      ctx.fillStyle = document.documentElement.getAttribute("data-theme") === "dark" ? "#94a3b8" : "#64748b";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(label, groupCenterX, padding.top + chartHeight + 8);
    });
  }

  // Draw Line Chart
  drawLineChart(canvasId, labels, data, color) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    ctx.clearRect(0, 0, width, height);

    const padding = { top: 20, right: 30, bottom: 40, left: 50 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const maxValue = Math.max(...data, 100) * 1.15;
    const minValue = Math.min(...data, 0);

    // Y Grid lines
    const gridLines = 5;
    ctx.strokeStyle = document.documentElement.getAttribute("data-theme") === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)";
    ctx.fillStyle = document.documentElement.getAttribute("data-theme") === "dark" ? "#94a3b8" : "#64748b";
    ctx.font = "10px Inter, sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    for (let i = 0; i <= gridLines; i++) {
      const yVal = minValue + ((maxValue - minValue) / gridLines) * i;
      const yPos = padding.top + chartHeight - ((yVal - minValue) / (maxValue - minValue)) * chartHeight;

      ctx.beginPath();
      ctx.moveTo(padding.left, yPos);
      ctx.lineTo(padding.left + chartWidth, yPos);
      ctx.stroke();

      ctx.fillText(Math.round(yVal).toLocaleString(), padding.left - 8, yPos);
    }

    const stepX = chartWidth / (labels.length - 1 || 1);
    
    // Draw Area under Line
    ctx.beginPath();
    labels.forEach((label, idx) => {
      const val = data[idx] || 0;
      const x = padding.left + idx * stepX;
      const y = padding.top + chartHeight - ((val - minValue) / (maxValue - minValue)) * chartHeight;
      if (idx === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.lineTo(padding.left + chartWidth, padding.top + chartHeight);
    ctx.lineTo(padding.left, padding.top + chartHeight);
    ctx.closePath();
    
    const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartHeight);
    gradient.addColorStop(0, color.replace(")", ", 0.25)").replace("rgb", "rgba"));
    gradient.addColorStop(1, color.replace(")", ", 0.0)").replace("rgb", "rgba"));
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw Line
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    labels.forEach((label, idx) => {
      const val = data[idx] || 0;
      const x = padding.left + idx * stepX;
      const y = padding.top + chartHeight - ((val - minValue) / (maxValue - minValue)) * chartHeight;
      if (idx === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    // Draw Markers & X-Labels
    labels.forEach((label, idx) => {
      const val = data[idx] || 0;
      const x = padding.left + idx * stepX;
      const y = padding.top + chartHeight - ((val - minValue) / (maxValue - minValue)) * chartHeight;

      // Draw dot
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Label text
      ctx.fillStyle = document.documentElement.getAttribute("data-theme") === "dark" ? "#94a3b8" : "#64748b";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(label, x, padding.top + chartHeight + 8);
    });
  }
}

export const reports = new ReportManager();
