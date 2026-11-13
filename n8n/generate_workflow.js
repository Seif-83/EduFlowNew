const fs = require('fs');
const path = require('path');

const workflow = {
  name: "EduFlow - LMS Automation Hub",
  nodes: [
    {
      parameters: {
        httpMethod: "POST",
        path: "eduflow",
        responseMode: "onReceived",
        responseData: "allEntries",
        options: {}
      },
      id: "a1000000-0000-0000-0000-000000000001",
      name: "Webhook - EduFlow Events",
      type: "n8n-nodes-base.webhook",
      typeVersion: 2,
      position: [180, 400],
      webhookId: "eduflow"
    },
    {
      parameters: {
        rule: {
          interval: [
            {
              field: "weeks",
              triggerAtDay: [1],
              triggerAtHour: 9,
              triggerAtMinute: 0
            }
          ]
        }
      },
      id: "a1000000-0000-0000-0000-000000000002",
      name: "Weekly Schedule Trigger",
      type: "n8n-nodes-base.scheduleTrigger",
      typeVersion: 1.2,
      position: [180, 640]
    },
    {
      parameters: {
        jsCode: `// Normalize incoming event payload
const input = $input.first().json;

let event = input.body?.event || input.event || 'test_ping';
let data = input.body?.data || input.data || {};
let timestamp = input.body?.timestamp || input.timestamp || new Date().toISOString();

// If triggered by schedule, default to payment and attendance check
if ($node["Weekly Schedule Trigger"] && Object.keys(input).length === 0) {
  event = 'payment_reminder';
  data = {
    source: 'weekly_cron',
    period: 'الاشتراك الشهري الحالي'
  };
}

return {
  json: {
    event,
    timestamp,
    received_at: new Date().toISOString(),
    data
  }
};`
      },
      id: "a1000000-0000-0000-0000-000000000003",
      name: "Normalize & Parse Event",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [440, 500]
    },
    {
      parameters: {
        dataType: "string",
        value1: "={{ $json.event }}",
        rules: {
          rules: [
            {
              value2: "exam_submitted",
              output: 0
            },
            {
              value2: "attendance_marked",
              output: 1
            },
            {
              value2: "payment_reminder",
              output: 2
            },
            {
              value2: "complaint_submitted",
              output: 3
            },
            {
              value2: "rag_ingest",
              output: 4
            },
            {
              value2: "test_ping",
              output: 5
            }
          ]
        },
        fallbackOutput: 5
      },
      id: "a1000000-0000-0000-0000-000000000004",
      name: "Router: Event Selector",
      type: "n8n-nodes-base.switch",
      typeVersion: 3,
      position: [700, 500]
    },
    // Branch 0: Exam Submitted
    {
      parameters: {
        jsCode: `const data = $json.data || {};
const earned = Number(data.earnedScore ?? data.score ?? 0);
const total = Number(data.totalScore ?? 100);
const percentage = total > 0 ? Math.round((earned / total) * 100) : 0;
const passingPercentage = Number(data.passingPercentage ?? 65);
const passed = percentage >= passingPercentage;

let gradeText = 'يحتاج لمزيد من الاجتهاد والمتابعة ⚠️';
if (percentage >= 90) gradeText = 'ممتاز مع مرتبة الشرف 🏆';
else if (percentage >= 75) gradeText = 'جيد جداً 🌟';
else if (percentage >= 60) gradeText = 'جيد وناجح 👍';

return {
  json: {
    student_name: data.student_name || 'طالب متميز',
    student_id: data.student_id || 'stu-unknown',
    exam_title: data.exam_title || 'اختبار تقييم المستوى',
    parent_email: data.parent_email || 'parent@eduflow.edu',
    parent_name: data.parent_name || 'ولي أمر الطالب',
    earned_score: earned,
    total_score: total,
    percentage,
    passing_percentage: passingPercentage,
    passed,
    grade_text: gradeText,
    submitted_at: $json.timestamp
  }
};`
      },
      id: "b1000000-0000-0000-0000-000000000001",
      name: "Evaluate Exam Result",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [980, 200]
    },
    {
      parameters: {
        conditions: {
          boolean: [
            {
              value1: "={{ $json.passed }}",
              value2: true
            }
          ]
        }
      },
      id: "b1000000-0000-0000-0000-000000000002",
      name: "Check If Exam Passed",
      type: "n8n-nodes-base.if",
      typeVersion: 2,
      position: [1220, 200]
    },
    {
      parameters: {
        jsCode: `const item = $json;
const emailHtml = \`
<div dir="rtl" style="font-family: Arial, Tahoma, sans-serif; max-width: 600px; margin: 0 auto; border: 2px solid #10b981; border-radius: 16px; overflow: hidden; background: #ffffff;">
  <div style="background: linear-gradient(135deg, #059669, #10b981); padding: 24px; text-align: center; color: white;">
    <h1 style="margin: 0; font-size: 24px;">🎓 منصة EduFlow التعليمية</h1>
    <p style="margin: 6px 0 0; opacity: 0.9; font-size: 15px;">تقرير النتيجة والشهادة الرقمية</p>
  </div>
  <div style="padding: 24px; color: #1e293b;">
    <p style="font-size: 16px;">السيد/ <strong>\${item.parent_name}</strong> المحترم،</p>
    <p style="font-size: 15px; line-height: 1.6;">
      يسرنا إبلاغكم بنجاح وتميز نجلكم/كريمتكم <strong>\${item.student_name}</strong> في اختبار:
    </p>
    <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 18px; margin: 18px 0; text-align: center;">
      <h3 style="margin: 0 0 10px; color: #166534; font-size: 18px;">\${item.exam_title}</h3>
      <div style="font-size: 32px; font-weight: bold; color: #15803d; margin: 8px 0;">\${item.percentage}%</div>
      <p style="margin: 0; color: #14532d; font-size: 15px;">الدرجة: <strong>\${item.earned_score} من \${item.total_score}</strong> (\${item.grade_text})</p>
    </div>
    <p style="font-size: 13px; color: #64748b;">تم رصد النتيجة بنجاح في سجلات الكنترول الأكاديمي لمنصة EduFlow عبر n8n.</p>
  </div>
  <div style="background: #f8fafc; padding: 14px; text-align: center; color: #94a3b8; font-size: 12px; border-top: 1px solid #e2e8f0;">
    نظام الإشعارات الآلي لمنصة EduFlow الذكية
  </div>
</div>
\`;

return {
  json: {
    status: 'success',
    action: 'parent_congratulation_sent',
    recipient: item.parent_email,
    subject: \`🎉 تهنئة بنجاح \${item.student_name} في اختبار \${item.exam_title}\`,
    html_content: emailHtml,
    sync_to_sheet: true,
    data: item
  }
};`
      },
      id: "b1000000-0000-0000-0000-000000000003",
      name: "Format Pass Certificate & Email",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [1460, 120]
    },
    {
      parameters: {
        jsCode: `const item = $json;
const warningHtml = \`
<div dir="rtl" style="font-family: Arial, Tahoma, sans-serif; max-width: 600px; margin: 0 auto; border: 2px solid #f59e0b; border-radius: 16px; overflow: hidden; background: #ffffff;">
  <div style="background: linear-gradient(135deg, #d97706, #f59e0b); padding: 24px; text-align: center; color: white;">
    <h1 style="margin: 0; font-size: 24px;">⚠️ منصة EduFlow التعليمية</h1>
    <p style="margin: 6px 0 0; opacity: 0.9; font-size: 15px;">تقرير المتابعة الأكاديمية</p>
  </div>
  <div style="padding: 24px; color: #1e293b;">
    <p style="font-size: 16px;">السيد/ <strong>\${item.parent_name}</strong> المحترم،</p>
    <p style="font-size: 15px; line-height: 1.6;">
      نحيطكم علماً بأن الطالب <strong>\${item.student_name}</strong> حصل في اختبار <strong>\${item.exam_title}</strong> على نتيجة:
    </p>
    <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; padding: 18px; margin: 18px 0; text-align: center;">
      <div style="font-size: 30px; font-weight: bold; color: #b45309; margin: 8px 0;">\${item.percentage}%</div>
      <p style="margin: 0; color: #92400e; font-size: 14px;">الدرجة: \${item.earned_score} من \${item.total_score} (الحد الأدنى للنجاح: \${item.passing_percentage}%)</p>
    </div>
    <div style="background: #f8fafc; border-right: 4px solid #6366f1; padding: 12px; border-radius: 8px; margin: 16px 0;">
      <h4 style="margin: 0 0 6px; color: #3730a3;">💡 خطة الدعم الفوري المقترحة:</h4>
      <ul style="margin: 0; padding-right: 18px; color: #475569; font-size: 13px;">
        <li>سيقوم المساعد الأكاديمي بالتواصل مع الطالب وتحديد مواطن الصعوبة.</li>
        <li>تم إتاحة اختبار تعويضي مخصص للطالب لمراجعة المفاهيم الأساسية.</li>
      </ul>
    </div>
  </div>
</div>
\`;

return {
  json: {
    status: 'needs_attention',
    action: 'remedial_support_alert_sent',
    recipient: item.parent_email,
    subject: \`📋 تقرير متابعة أكاديمية: اختبار \${item.exam_title} للطالب \${item.student_name}\`,
    html_content: warningHtml,
    assistant_task_created: true,
    data: item
  }
};`
      },
      id: "b1000000-0000-0000-0000-000000000004",
      name: "Format Remedial Notice",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [1460, 260]
    },
    // Branch 1: Attendance Marked
    {
      parameters: {
        jsCode: `const data = $json.data || {};
const records = Array.isArray(data.records) ? data.records : [data];
const absentStudents = records.filter(r => (r.status || '').toLowerCase() === 'absent');

return {
  json: {
    total_checked: records.length,
    absent_count: absentStudents.length,
    group_name: data.group_name || 'المجموعة الدراسية العامة',
    session_title: data.session_title || 'الحصة الأسبوعية',
    date: data.date || new Date().toISOString().split('T')[0],
    absent_students: absentStudents.map(s => ({
      student_name: s.student_name || 'طالب',
      student_id: s.student_id,
      parent_phone: s.parent_phone || 'غير مسجل',
      parent_email: s.parent_email || 'parent@eduflow.edu',
      consecutive_absences: Number(s.consecutive_absences || 1)
    }))
  }
};`
      },
      id: "c1000000-0000-0000-0000-000000000001",
      name: "Filter Absent Students",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [980, 420]
    },
    {
      parameters: {
        jsCode: `const item = $json;
const absent = item.absent_students || [];

const messages = absent.map(s => {
  const isCritical = s.consecutive_absences >= 2;
  return {
    recipient_email: s.parent_email,
    recipient_phone: s.parent_phone,
    student_name: s.student_name,
    is_critical: isCritical,
    sms_text: \`منصة EduFlow: نود إحاطتكم بغياب \${s.student_name} عن \${item.session_title} (\${item.group_name}) بتاريخ \${item.date}.\${isCritical ? ' تنبيه: هذا هو الغياب الثاني على التوالي، نرجو التواصل فوراً.' : ''}\`,
    email_subject: \`⚠️ إشعار غياب: الطالب \${s.student_name} - \${item.group_name}\`
  };
});

return {
  json: {
    status: 'success',
    total_absent_alerts: messages.length,
    session: item.session_title,
    group: item.group_name,
    date: item.date,
    dispatched_notifications: messages
  }
};`
      },
      id: "c1000000-0000-0000-0000-000000000002",
      name: "Generate Absence Alerts",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [1260, 420]
    },
    // Branch 2: Payment Reminder
    {
      parameters: {
        jsCode: `const data = $json.data || {};
const students = Array.isArray(data.students) ? data.students : [
  {
    student_name: data.student_name || 'عمر حازم السيد',
    parent_email: data.parent_email || 'walid.hazem@gmail.com',
    amount: data.amount || 450,
    due_date: data.due_date || '2026-10-05',
    invoice_title: data.invoice_title || 'اشتراك شهر أكتوبر 2026'
  }
];

const reminders = students.map(st => {
  return {
    parent_email: st.parent_email,
    student_name: st.student_name,
    amount: st.amount,
    currency: 'EGP',
    due_date: st.due_date,
    invoice_title: st.invoice_title,
    message: \`سعادة ولي أمر الطالب \${st.student_name}، نود تذكيركم بموعد سداد (\${st.invoice_title}) وقيمته \${st.amount} ج.م والمستحق في \${st.due_date}. يمكن السداد عبر فودافون كاش أو الدفع الإلكتروني بالمنصة.\`
  };
});

return {
  json: {
    status: 'success',
    action: 'billing_reminders_generated',
    count: reminders.length,
    reminders
  }
};`
      },
      id: "d1000000-0000-0000-0000-000000000001",
      name: "Process Billing Reminders",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [980, 560]
    },
    // Branch 3: Complaint Submitted
    {
      parameters: {
        jsCode: `const data = $json.data || {};
const ticketId = 'EDF-' + Math.floor(100000 + Math.random() * 900000);
const category = data.category || 'general';

let priority = 'عادية';
if (category === 'academic' || category === 'complaint') priority = 'عالية 🔴';
else if (category === 'billing') priority = 'متوسطة 🟡';

return {
  json: {
    ticket_id: ticketId,
    submitter_name: data.user_name || 'أحد مستخدمي المنصة',
    submitter_role: data.user_role || 'parent',
    title: data.title || 'طلب متابعة وملاحظة',
    description: data.description || '',
    category,
    priority,
    created_at: new Date().toISOString(),
    admin_alert: \`🚨 تذكرة دعم جديدة [#\${ticketId}]: \${data.title} - الأولوية: \${priority}\`,
    user_receipt: \`شكراً لتواصلك معنا. تم تسجيل تذكرتك برقم #\${ticketId} وجاري مراجعتها من قبل إدارة EduFlow.\`
  }
};`
      },
      id: "e1000000-0000-0000-0000-000000000001",
      name: "Triage Support Complaint",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [980, 700]
    },
    // Branch 4: RAG Course Material Ingestion
    {
      parameters: {
        jsCode: `const data = $json.data || {};
const content = data.content || data.lesson_text || 'مفاهيم الوحدة الدراسية الأساسية';
const title = data.title || 'المحاضرة التعليمية';

// Simulate semantic chunking
const chunks = [
  { chunk_id: 1, text: content.slice(0, 300), token_estimate: 75 },
  { chunk_id: 2, text: content.slice(300, 600), token_estimate: 80 }
];

return {
  json: {
    status: 'indexed',
    material_title: title,
    chunks_count: chunks.length,
    vector_dimensions: 768,
    model: 'text-embedding-004 / Gemini AI',
    chunks,
    ai_status: 'جاهز للإجابة عبر شات بوت الذكاء الاصطناعي للطالب'
  }
};`
      },
      id: "f1000000-0000-0000-0000-000000000001",
      name: "RAG Embeddings & Ingestion",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [980, 840]
    },
    // Branch 5: Test Ping
    {
      parameters: {
        jsCode: `return {
  json: {
    status: 'success',
    ping: 'pong',
    service: 'EduFlow n8n Engine',
    uptime_check: 'Healthy 🟢',
    endpoints_active: [
      'exam_submitted',
      'attendance_marked',
      'payment_reminder',
      'complaint_submitted',
      'rag_ingest'
    ],
    timestamp: new Date().toISOString()
  }
};`
      },
      id: "g1000000-0000-0000-0000-000000000001",
      name: "Test Ping Diagnostics",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [980, 980]
    },
    // Final Response Node
    {
      parameters: {
        respondWith: "json",
        responseBody: "={{ JSON.stringify($json) }}",
        options: {}
      },
      id: "z1000000-0000-0000-0000-000000000001",
      name: "Respond to Webhook",
      type: "n8n-nodes-base.respondToWebhook",
      typeVersion: 1.1,
      position: [1800, 500]
    }
  ],
  connections: {
    "Webhook - EduFlow Events": {
      main: [
        [
          {
            node: "Normalize & Parse Event",
            type: "main",
            index: 0
          }
        ]
      ]
    },
    "Weekly Schedule Trigger": {
      main: [
        [
          {
            node: "Normalize & Parse Event",
            type: "main",
            index: 0
          }
        ]
      ]
    },
    "Normalize & Parse Event": {
      main: [
        [
          {
            node: "Router: Event Selector",
            type: "main",
            index: 0
          }
        ]
      ]
    },
    "Router: Event Selector": {
      main: [
        // Output 0: exam_submitted
        [
          {
            node: "Evaluate Exam Result",
            type: "main",
            index: 0
          }
        ],
        // Output 1: attendance_marked
        [
          {
            node: "Filter Absent Students",
            type: "main",
            index: 0
          }
        ],
        // Output 2: payment_reminder
        [
          {
            node: "Process Billing Reminders",
            type: "main",
            index: 0
          }
        ],
        // Output 3: complaint_submitted
        [
          {
            node: "Triage Support Complaint",
            type: "main",
            index: 0
          }
        ],
        // Output 4: rag_ingest
        [
          {
            node: "RAG Embeddings & Ingestion",
            type: "main",
            index: 0
          }
        ],
        // Output 5: test_ping / fallback
        [
          {
            node: "Test Ping Diagnostics",
            type: "main",
            index: 0
          }
        ]
      ]
    },
    "Evaluate Exam Result": {
      main: [
        [
          {
            node: "Check If Exam Passed",
            type: "main",
            index: 0
          }
        ]
      ]
    },
    "Check If Exam Passed": {
      main: [
        // True branch (Passed)
        [
          {
            node: "Format Pass Certificate & Email",
            type: "main",
            index: 0
          }
        ],
        // False branch (Failed)
        [
          {
            node: "Format Remedial Notice",
            type: "main",
            index: 0
          }
        ]
      ]
    },
    "Format Pass Certificate & Email": {
      main: [
        [
          {
            node: "Respond to Webhook",
            type: "main",
            index: 0
          }
        ]
      ]
    },
    "Format Remedial Notice": {
      main: [
        [
          {
            node: "Respond to Webhook",
            type: "main",
            index: 0
          }
        ]
      ]
    },
    "Filter Absent Students": {
      main: [
        [
          {
            node: "Generate Absence Alerts",
            type: "main",
            index: 0
          }
        ]
      ]
    },
    "Generate Absence Alerts": {
      main: [
        [
          {
            node: "Respond to Webhook",
            type: "main",
            index: 0
          }
        ]
      ]
    },
    "Process Billing Reminders": {
      main: [
        [
          {
            node: "Respond to Webhook",
            type: "main",
            index: 0
          }
        ]
      ]
    },
    "Triage Support Complaint": {
      main: [
        [
          {
            node: "Respond to Webhook",
            type: "main",
            index: 0
          }
        ]
      ]
    },
    "RAG Embeddings & Ingestion": {
      main: [
        [
          {
            node: "Respond to Webhook",
            type: "main",
            index: 0
          }
        ]
      ]
    },
    "Test Ping Diagnostics": {
      main: [
        [
          {
            node: "Respond to Webhook",
            type: "main",
            index: 0
          }
        ]
      ]
    }
  },
  settings: {
    executionOrder: "v1"
  }
};

const outputPath1 = path.join(__dirname, 'eduflow-automation-workflow.json');
const outputPath2 = path.join(__dirname, '..', 'eduflow-n8n-workflow.json');

fs.writeFileSync(outputPath1, JSON.stringify(workflow, null, 2), 'utf8');
fs.writeFileSync(outputPath2, JSON.stringify(workflow, null, 2), 'utf8');

console.log('Successfully generated n8n workflow JSON at:');
console.log('1.', outputPath1);
console.log('2.', outputPath2);
