// +==========================================================+
// |           JIRA REPORTSUITE -- SCRIPT TABLE OF CONTENTS    |
// |  Ctrl+F the section name to jump directly to it.         |
// +==========================================================+
//
// -- FOUNDATION --------------------------------------------
//   STATE                                      ~line 1748
//   DEFAULT TOPICS                             ~line 1846
//   NAVIGATION                                 ~line 1851
//   UTILS                                      ~line 6864
//
// -- DATA --------------------------------------------------
//   CSV PARSING                                ~line 1861
//   FILE LOADING                               ~line 2207
//   MATCH ENGINE                               ~line 2419
//   JIRA API                                   ~line 4970
//
// -- PERSISTENCE -------------------------------------------
//   CONFIG PERSISTENCE                         ~line 2500
//   CONFIG UI RENDER                           ~line 3092
//   CLASSIFICATION SELECTOR                    ~line 3104
//   REPORT DRAFT SAVE / RESTORE                ~line 6051
//   DOWNLOAD / EXPORT                          ~line 5318
//
// -- UI COMPONENTS -----------------------------------------
//   TABS                                       ~line 2454
//   DATE RANGE PICKER                          ~line 5773
//   COLLAPSIBLE PARAMETER PANELS               ~line 6852
//   SHARED HTML HELPERS                        ~line 4655
//   CLIPBOARD HELPERS                          ~line 6826
//
// -- SETTINGS ----------------------------------------------
//   TOPICS EDITOR                              ~line 3525
//   PEOPLE UI                                  ~line 3680
//   SETTINGS OVERLAY                           ~line 7482
//   APP-LEVEL APPEARANCE                       ~line 7503
//
// -- REPORTS -----------------------------------------------
//   WEEKLY REPORT                              ~line 3737
//   EOS REPORT                                 ~line 3887
//   PMR REPORT                                 ~line 4069
//   SPRINT METRICS                             ~line 4307
//   PMR NARRATIVE EXPORT                       ~line 6272
//   COPY WEEKLY FOR EMAIL                      ~line 6646
//   SPRINT DELTA                               ~line 6735
//   UNMATCHED PANEL                            ~line 4837
//
// -- SPIN PLAN ---------------------------------------------
//   SPIN PLAN — ENGINE                         ~line 7615
//   SPIN PLAN — INLINE PREFS PANEL             ~line 8612
//   SPIN PLAN — PREFERENCES                    ~line 8843
//   SPIN PLAN — COLUMN VIEW                    ~line 9717
//
// -- FRAMEWORK ---------------------------------------------
//   WIZARD ENGINE                              ~line 6880
//   REPORT FRAME CONTROLS                      ~line 10262
//
// -- GUIDE -------------------------------------------------
//   GUIDE                                      ~line 6047
//
// -- TESTS -------------------------------------------------
//   JIRA REPORTSUITE                           ~line 10322
//   TEST SUITES                                ~line 10403
//
// ==========================================================

const APP_VERSION='v9.2';

// ============================================================
// STATE
// ============================================================
const S = {
  files: { issues: null, epics: null, spin: null, start: null, final: null },
  _fileRegistry: {},    // filename -> { type, rows, file } — all loaded files
  fileNames: { issues: '', epics: '' },
  epicMap: {},          // epic_key -> epic_name
  allTickets: [],       // parsed from issues CSV
  overrides: [],        // [{ticket_key,summary,target_topic_id,rule_type,value,excl_topic_id}]
  pendingOverride: null,
  reportHtml: { weekly: '', eos: '', pmr: '', sprint: '' },
  currentPage: 'files',

  cfg: {
    classification: 'UNCLASSIFIED',
    bt_do_line: 'BT DO1: Data-Centric',
    report_number: '', contract_number: '', cdrl_number: '', did_numbers: '',
    num_plan: '', num_report: '', num_stories: '', num_incident: '',
    prepared_for_addr1: '', prepared_for_addr2: '',
    prepared_by_addr1: '', prepared_by_addr2: '',
    prepared_for: 'MPO', prepared_by: 'NIS / CODEX Division',
    roles: [{role:'Project Owner',name:'',id:''},{role:'Technical Lead',name:'',id:''},{role:'Government Approver',name:'',id:''}],
    weekly: {
      backend_components: ['neo4j','kea'],
      user_facing_components: ['search engine','results grid','entity detail','filter controls','admin panel','graph renderer','entity profile','watchlist service','ui shell','notification service','link traversal','data fetch layer'],
      always_include_labels: ['dxs','gats'],
      excluded_summary_keywords: ['rest client','grid layout','panel view'],
      excluded_epic_keys: [],
      status_order: ['Blocked','Done','Closed','Reviewing','In Test','In Progress','Open']
    },
    eos_projects: {
      DX: { report_title: '(U) DataXplorer End of Sprint Report', mtl_points: '5-10' },
      LX: { report_title: '(U) LinkXplorer End of Sprint Report', mtl_points: '5-10' },
      RC: { report_title: '(U) RC End of Sprint Report', mtl_points: '5-10' }
    },
    eos_ai_prompt_enabled: true,
    eos_ai_prompt: 'You are summarizing Jira tickets for a government contract sprint review briefing. Create a summary that is easy to read out loud. Use a single paragraph, less than 300 words. Do not include ticket numbers. Combine similar tasks into cohesive statements. Every sentence must start with the portion marking (U).\n\nFor completed work, start with: "(U) During this sprint, the team..."\nFor planned work, start with: "(U) For the next sprint, the team plans to..."',
    pmr_ai_prompt_enabled: true,
    pmr_ai_prompt: 'You are writing the narrative section of a monthly Program Management Review (PMR) for a government contract. For each topic below, write a concise 2-3 sentence paragraph summarizing the work completed this reporting period. Write in past tense, third person ("the team"). Focus on outcomes and progress, not individual tickets. Combine related work into cohesive statements. Do not mention ticket numbers. Start every sentence with the portion marking (U). If a topic has no completed work, write "(U) No reportable activity this period."',
    // Slide template geometry — editable via Tools → Slide Templates.
    // Each layout type has its own set of dimensions (inches). The PPTX
    // helpers read from here instead of hardcoded constants.
    pmr_slide_templates: {
      feature_improvement_bug: {
        leftWidthPct: 0.58,   // left card width as % of content area
        rightGap: 0.15,       // gap between left and right cards
        cardBorder: 0.75,     // border width in pt
        narFontSize: 13,      // narrative text font size
        labelFontSize: 11,    // section label font size
      },
      project_split: {
        tagW: 1.10,           // product tag block width
        tagGap: 0.08,         // gap between tag and narrative card
        rowGap: 0.18,         // gap between product rows
        narFontSize: 13,
        codeFontSize: 26,     // DX/LX/RC big letter
        nameFontSize: 10,     // DataXplorer/LinkXplorer text
      },
      mission_support: {
        tagW: 1.10,
        colGap: 0.05,         // gap between column cells
        rowGap: 0.04,
        headerH: 0.30,        // column header height
        narFontSize: 11,
        headerFontSize: 9,
      },
      simple_list: {
        narFontSize: 13,
        labelFontSize: 11,
        cardBorder: 0.75,
      },
      near_future: {
        panelW: 2.67,         // near-future panel width
        panelGap: 0.26,       // gap between content and panel
        titleFontSize: 10,
        bodyFontSize: 10,
        bulletGap: 0.78,      // vertical spacing between bullets
      },
      title_slide: {
        leftPanelW: 7.063,    // left navy panel width
        titleFontSize: 44,    // main title
        subtitleFontSize: 18, // "Monthly Progress Report"
        chipFontSize: 14,     // info chip value font
        chipLabelFontSize: 10.5, // info chip label font
        rightTitleFontSize: 34, // "Program Management Review"
      },
      agenda: {
        itemH: 0.30,          // height per agenda item
        headerH: 0.27,        // section header height
        colGap: 0.2,          // gap between left and right columns
        itemFontSize: 13,     // agenda item text
        headerFontSize: 11,   // "TOPICS" header
      },
      global: {
        headerFontSize: 22,   // slide title
        bodyBg: 'F7F5F1',     // slide background
        cardBg: 'FFFFFF',     // card fill
      }
    },
    pmr_title: '(U) Xplorer Suite PMR',
    pmr_groups: [
      { group_id: 'dx_modernization', header: 'Tier 1: Priority 2: Tool Modernization: DX', topic_ids: ['dx4','dx_improvements'] },
      { group_id: 'lx_modernization', header: 'Tier 1: Priority 2: Tool Modernization: LX', topic_ids: ['lx5','lx_improvements'] }
    ],
    pmr_layouts: {
      tile:'simple_list', bay:'simple_list', swing:'feature_improvement_bug',
      hci_migration:'project_split_3', dx_modernization:'feature_improvement_bug',
      lx_modernization:'feature_improvement_bug', rc_improvements:'feature_improvement_bug',
      gcenext:'project_split_2', nanostorm_td:'project_split_2', sdp:'project_split_2',
      dx_sustainment:'mission_support_other', lx_sustainment:'mission_support_other',
      rc_sustainment:'mission_support_other', aiml_integration:'project_split_3',
      '508_compliance':'project_split_3', techsigint_revitalization:'project_split_3'
    },
    // ── Integrated Milestone Roadmap (slide + editor) ───────────────────────
    // Milestones are seeded from the spin plan (S.spin.issues) and then
    // curated per-PMR via the editor on the PMR config page. Selection is
    // per-slide so a milestone can appear on the overview and/or zoomed view.
    // Note: year + range are stamped at page-load from new Date(), so a fresh
    // install in Jan 2027 auto-targets 2027. _migrateCfg() backfills the same
    // way for configs saved before this feature existed.
    pmr_roadmap: (function(){
      const y = new Date().getFullYear();
      return {
        enabled: true,
        // 1 or 2 slide definitions. The user can toggle between one overview
        // slide and an overview + zoomed pair from the editor.
        slides: [
          {
            id: 'overview',
            title: 'Integrated Milestone Roadmap',
            mode: 'months',            // 'months' | 'quarters'
            year: y,
            rangeStart: y + '-01',     // inclusive YYYY-MM
            rangeEnd:   y + '-12',     // inclusive YYYY-MM
            tiers: ['T0','T1','T2','T3'],
            emphasizeTier: 'T1'        // row gets 2.5× weight
          }
        ],
        // Per-ticketKey snapshot. Seeded from spin plan, survives re-seeds.
        // Deselection (slideIds=[]) is sticky across re-seeds.
        milestones: [],
        seedVersion: 0
      };
    })(),
    // Leave empty so initState() populates from DEFAULT_SPRINT_CALENDAR (single source of truth).
    sprint_calendar: [],
    schedule_blurbs: ['TBD','TBD','TBD','TBD'],
    excluded_assignees: ["xtavery", "beblant", "cdgold", "kahurd", "twspeng", "rhle", "gjmcgar", "vvillar", "amweste"],
    // jira_base_url kept in default state only so _migrateCfg() can promote old saved configs
    jira_url: 'https://jira.company.com',
    classification_presets: ['(U) UNCLASSIFIED'],
    portion_markings: ['(U)'],
    hdr_footer_classifications: ['UNCLASSIFIED','(U) UNCLASSIFIED'],
    prepared_for_name: 'MPO',
    prepared_by_name: 'NIS / CODEX Division',
    // Report metadata
    classification_highest: '',
    portion_marking_active: '',
    sprint_report_title: 'Agile Acquisition Sprint Package',
    sprint_cover_title: 'Agile Acquisition Sprint Comprehensive Plan',
    graph_analytics_release_label: 'Graph Analytics Release Number',
    graph_analytics_blurb: 'TBD',
    afx_release_label: 'AFX Release Number',
    // Address fields
    prepared_for_csz: '',
    prepared_by_org: '',
    prepared_by_csz: '',
    sprint_prefixes: ['DX','LX','RC','RCR','AFX'],
    pmr_feature_types: ['story','user request','new feature'],
    pmr_bug_types: ['bug','defect'],
    // improvement = anything not in feature or bug types
    field_map: [
      {raw:'Custom field (Epic Name)',   canonical:'Epic Name'},
      {raw:'Custom field (Epic Link)',   canonical:'Epic Link'},
      {raw:'Custom field (Story Points)',canonical:'Story Points'},
      {raw:'Custom field (Sprint)',      canonical:'Sprint'},
      {raw:'Story point estimate',       canonical:'Story Points'},
    ]
  },

  topics: [],   // loaded below
  _pendingDraft: {},  // keyed by report type — draft loaded at wizard step 0, applied after report renders
  _lastVba: null,
  _unmatchedLookup: {},  // safeId -> ticket object; populated by unmatchedPanel()
};

// Jira API state — session only, never persisted
S.api = { url: '', user: '', token: '', connected: false };
S._wizParams = {};

// ============================================================
// DEFAULT TOPICS
// ============================================================
S.topics = [{"topic_id":"tile","header":"Tier 0: Priority 1: Strategic Surge Support: TILE","tier_rank":0,"projects":["LX"],"epic_keys":[],"exact_phrases":[],"keywords":["tile"],"exclude_keywords":[]},{"topic_id":"bay","header":"Tier 0: Priority 1: Strategic Surge Support: BAY","tier_rank":0,"projects":["DX","LX","RC"],"epic_keys":["DX-19545"],"exact_phrases":[],"keywords":["bay"],"exclude_keywords":[]},{"topic_id":"swing","header":"Tier 0: Priority 2: Strategic Surge Support: SWING","tier_rank":0,"projects":["LX"],"epic_keys":["LX-4989","LX-4958","LX-4144","LX-4116","LX-4073"],"exact_phrases":[],"keywords":["swca","swing"],"exclude_keywords":[]},{"topic_id":"hci_migration","header":"Tier 1: Priority 1: HCI Migration","tier_rank":1,"projects":["DX","LX","RC"],"epic_keys":["DX-25742","DX-25663","DX-21480","DX-25696","LX-3772","LX-3735","RCR-8309","RCR-8202","RCR-7643","RCR-5641"],"exact_phrases":["prepare for hci eks"],"keywords":["hci","migration","rehosting","eks","wands","cve","vulnerab"],"exclude_keywords":[]},{"topic_id":"dx4","header":"Tier 1: Priority 2: Tool Modernization: DX4","tier_rank":2,"projects":["DX"],"epic_keys":["DX-26151","DX-25425","DX-25474","DX-25113","DX-24791","DX-24625","DX-24623","DX-24405","DX-23477"],"exact_phrases":[],"keywords":["dx4","results grid","panel interactions","saved results"],"exclude_keywords":["hci","cve","vulnerab"]},{"topic_id":"dx_improvements","header":"Tier 1: Priority 2: Tool Modernization: DX Improvements","tier_rank":2,"projects":["DX"],"epic_keys":["DX-26008","DX-25996","DX-25945","DX-25943","DX-25941","DX-25476","DX-25383","DX-25361","DX-25117"],"exact_phrases":[],"keywords":["search form","frontend","backend","authorization","access","query","recurring"],"exclude_keywords":["hci","cve","vulnerab"]},{"topic_id":"lx_improvements","header":"Tier 1: Priority 2: Tool Modernization: LX Improvements","tier_rank":2,"projects":["LX"],"epic_keys":["LX-4995","LX-4991","LX-4952","LX-4728","LX-4713"],"exact_phrases":[],"keywords":["feature","integration","automation","request","gats","dxs requests"],"exclude_keywords":["hci","swca"]},{"topic_id":"lx5","header":"Tier 1: Priority 2: Tool Modernization: LX5","tier_rank":2,"projects":["LX"],"epic_keys":["LX-4948"],"exact_phrases":[],"keywords":["lx5","baseline","neo4j","graph"],"exclude_keywords":["hci","swca"]},{"topic_id":"rc_improvements","header":"Tier 1: Priority 2: Tool Modernization: RC Improvements","tier_rank":2,"projects":["RC"],"epic_keys":["RCR-8595","RCR-8587","RCR-8549","RCR-8484","RCR-8469","RCR-8018","RCR-7729","RCR-3906"],"exact_phrases":["transition to restclient"],"keywords":["restclient","rest client","ci cd","pipeline","automation","devops","locking","reference data","tool modernization"],"exclude_keywords":["hci","cve","vulnerab","enclave","sdp"]},{"topic_id":"gcenext","header":"Tier 1: Priority 3: GCENext","tier_rank":3,"projects":["DX","RC"],"epic_keys":["DX-25118","RCR-8471"],"exact_phrases":[],"keywords":["gce","gcenext"],"exclude_keywords":[]},{"topic_id":"nanostorm_td","header":"Tier 1: Priority 3: NANOSTORM T&D","tier_rank":3,"projects":["DX","RC"],"epic_keys":[],"exact_phrases":[],"keywords":["nanostorm","t d","training"],"exclude_keywords":[]},{"topic_id":"sdp","header":"Tier 1: Priority 4: SDP","tier_rank":4,"projects":["DX","RC"],"epic_keys":["RCR-4444"],"exact_phrases":[],"keywords":["enclave","sdp"],"exclude_keywords":[]},{"topic_id":"dx_sustainment","header":"Tier 2: Priority 1: Mission Support: DX Sustainment","tier_rank":5,"projects":["DX"],"epic_keys":["DX-25114"],"exact_phrases":[],"keywords":["bug","fix","mission support","support"],"exclude_keywords":["hci","dx4","search form","frontend","backend"]},{"topic_id":"lx_sustainment","header":"Tier 2: Priority 1: Mission Support: LX Sustainment","tier_rank":5,"projects":["LX"],"epic_keys":["LX-3786","LX-3530"],"exact_phrases":[],"keywords":["publish","deploy","infrastructure","compliance"],"exclude_keywords":["swca","hci","neo4j","graph"]},{"topic_id":"rc_sustainment","header":"Tier 2: Priority 1: Mission Support: RC Sustainment","tier_rank":5,"projects":["RC"],"epic_keys":["RCR-8068","RCR-8067"],"exact_phrases":[],"keywords":["bug","mission support","support"],"exclude_keywords":["hci","rest client","enclave"]},{"topic_id":"aiml_integration","header":"Tier 2: Priority 1: Mission Support: AI/ML Capability Integration","tier_rank":5,"projects":["DX","LX","RC"],"epic_keys":["DX-26140"],"exact_phrases":[],"keywords":["ai ml","ai","ml"],"exclude_keywords":[]},{"topic_id":"508_compliance","header":"Tier 2: Priority 1: Mission Support: 508 Compliance","tier_rank":5,"projects":["DX","LX","RC"],"epic_keys":["DX-26156"],"exact_phrases":[],"keywords":["508"],"exclude_keywords":[]},{"topic_id":"techsigint_revitalization","header":"Tier 3: Priority 1: TechSIGINT Revitalization","tier_rank":6,"projects":["DX","LX","RC"],"epic_keys":["RCR-3657"],"exact_phrases":[],"keywords":["techsigint","tsr"],"exclude_keywords":[]}];

