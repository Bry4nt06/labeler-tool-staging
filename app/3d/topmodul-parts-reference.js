(function installServoForgeTopModulPartsReference(global) {
  "use strict";

  const REFERENCE_VERSION = "servoforge.topmodul-parts-reference.v1";
  const SOURCE_ARCHIVE = "Krones TopModul Basic Labeling Station, Parts (2).zip";
  const SOURCE_AUTHORITY = "user-supplied-krones-topmodul-parts-manuals-2026-08-18";

  function freeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.values(value).forEach(freeze);
    return Object.freeze(value);
  }

  const DOCUMENTS = freeze({
    basic: { title: "Krones TopModul Basic Labeling Station, Parts", pages: 117 },
    aggregates: { title: "Krones TopModul Labeler Aggregates, Parts", pages: 590 },
    bottom: { title: "Krones TopModul Labeler Bottom, Parts", pages: 71 },
    center: { title: "Krones TopModul Labeler Center, Parts", pages: 104 },
    exterior: { title: "Krones TopModul Labeler Exterior, Parts", pages: 214 },
    top: { title: "Krones TopModul Labeler Top, Parts", pages: 27 },
    additionalEquipment: { title: "Krones TopModul Labeler, Additional Equipment, Parts", pages: 7 },
    handling: { title: "Krones TopModul Labeler, Handling Parts", pages: 227 }
  });

  // This reference stores hierarchy/identity evidence extracted from the user-
  // supplied parts books. It does not turn a listed part into dimensional CAD
  // authority unless an actual dimension has separately been measured or read
  // from an explicit dimensioned drawing.
  const ASSEMBLIES = freeze({
    labelApplicatorHead: {
      id: "label-applicator-head",
      manual: "aggregates",
      drawingPages: [48, 49],
      drawingReference: "0-900-571-103",
      designation: "LABEL APPLICATOR HEAD",
      authority: "manual-hierarchy-and-part-identity",
      confirmedParts: ["frame", "guard", "angle/elbow", "actuation device", "handle", "fasteners"]
    },
    abLabelApplicationArm: {
      id: "ab-label-application-arm",
      manual: "aggregates",
      drawingPages: [52, 53],
      drawingReference: "0-900-588-044",
      designation: "AB LABEL APPLICATION ARM",
      authority: "manual-hierarchy-and-part-identity",
      confirmedParts: [
        "application wedge",
        "section",
        "plate",
        "sprocket idler L=119",
        "AB stop photoelectric sensor assembly",
        "measuring tape",
        "bearings/bushings",
        "adjustment fasteners"
      ]
    },
    applicationWedge: {
      id: "application-wedge",
      manual: "aggregates",
      drawingPages: [54, 55],
      drawingReference: "0-900-585-924",
      designation: "APPLICATION WEDGE",
      authority: "manual-hierarchy-and-part-identity",
      confirmedParts: [
        "guide plate",
        "infeed housing",
        "sprocket idler L=119",
        "mounting plate",
        "clamping plates",
        "bearings",
        "clevis L=55",
        "plates/disks",
        "adjustment bolt"
      ],
      variantNote: "The AB Label Application Arm BOM also references an application-wedge variant 0-900-58-592-6; keep variants distinct until machine-specific applicability is confirmed."
    },
    rollerAssemblies: {
      id: "aggregate-roller-assemblies",
      manual: "aggregates",
      drawingPages: [37, 38, 39, 40, 41, 42],
      designations: ["ROLLER ASY L= 174", "ROLLER ASY L=120", "ROLLER"],
      authority: "manual-hierarchy-and-part-identity"
    },
    handlingStarWheels: {
      id: "handling-star-wheels",
      manual: "handling",
      designation: "STAR WHEEL / STARWHEEL handling assemblies",
      authority: "manual-reference-available-needs-drawing-extraction",
      notes: "The handling-parts book contains star-wheel and infeed handling references for the future bottle-transfer subsystem."
    }
  });

  function document(id) {
    return DOCUMENTS[String(id || "")] || null;
  }

  function assembly(id) {
    return ASSEMBLIES[String(id || "")] || null;
  }

  function status() {
    return freeze({
      referenceVersion: REFERENCE_VERSION,
      sourceArchive: SOURCE_ARCHIVE,
      sourceAuthority: SOURCE_AUTHORITY,
      documentCount: Object.keys(DOCUMENTS).length,
      assemblyCount: Object.keys(ASSEMBLIES).length,
      dimensionsAutomaticallyAuthoritative: false,
      manuals: Object.keys(DOCUMENTS),
      assemblies: Object.keys(ASSEMBLIES)
    });
  }

  global.Labeler3DTopModulPartsReference = freeze({
    REFERENCE_VERSION,
    SOURCE_ARCHIVE,
    SOURCE_AUTHORITY,
    DOCUMENTS,
    ASSEMBLIES,
    document,
    assembly,
    status
  });
})(window);
