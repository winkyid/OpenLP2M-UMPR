const groups = window.daftarKelompok;

if (!Array.isArray(groups) || groups.length !== 25) {
  throw new Error("Data kelompok harus berisi tepat 25 kelompok.");
}

const groupGrid = document.querySelector("#group-grid");
const searchInput = document.querySelector("#group-search");
const resultCount = document.querySelector("#result-count");
const dataStatus = document.querySelector("#data-status");
const emptyState = document.querySelector("#empty-state");
const dialog = document.querySelector("#group-dialog");
const closeDialogButton = document.querySelector("#close-dialog");
const detailPanel = document.querySelector("#detail-panel");
const webViewPanel = document.querySelector("#web-view-panel");
const dialogGroupNumber = document.querySelector("#dialog-group-number");
const dialogTitle = document.querySelector("#dialog-title");
const dialogDescription = document.querySelector("#dialog-description");
const previewImage = document.querySelector("#preview-image");
const previewPlaceholder = document.querySelector("#preview-placeholder");
const openWebViewButton = document.querySelector("#open-web-view");
const openRawSheetButton = document.querySelector("#open-raw-sheet");
const viewerTitle = document.querySelector("#viewer-title");
const nativeTableView = document.querySelector("#native-table-view");
const rawSheetView = document.querySelector("#raw-sheet-view");
const tableStatus = document.querySelector("#table-status");
const membersTableHead = document.querySelector("#members-table-head");
const membersTableBody = document.querySelector("#members-table-body");
const spreadsheetFrame = document.querySelector("#spreadsheet-frame");
const spreadsheetLoading = document.querySelector("#spreadsheet-loading");
const memberRowsByGroup = new Map();
let activeGroupNumber = 0;
let metadataLoading = true;

const displayName = (group, number) => group.nama?.trim() || `Kelompok ${number}`;
const availableValue = (value) => value?.trim() || "Belum ditambahkan";

function normalizeSearchText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("id");
}

function setLoadingStatus(element, message, isLoading) {
  element.replaceChildren();
  element.setAttribute("aria-busy", String(isLoading));

  if (isLoading) {
    const spinner = document.createElement("span");
    spinner.className = "loading-spinner";
    spinner.setAttribute("aria-hidden", "true");
    element.append(spinner);
  }

  const text = document.createElement("span");
  text.textContent = message;
  element.append(text);
}

function renderGroups(query = "") {
  if (metadataLoading) {
    renderGroupSkeletons();
    return;
  }

  const searchTerms = normalizeSearchText(query).split(/\s+/).filter(Boolean);
  const matchingGroups = groups
    .map((group, index) => ({ group, number: index + 1 }))
    .filter(({ group, number }) => {
      const rosterRows = memberRowsByGroup.get(number)?.roster.rows ?? [];
      const groupText = normalizeSearchText([
        displayName(group, number),
        `kelompok ${number}`,
        group.dpl,
        group.ketua_kelompok,
        group.lokasi,
        group.keterangan,
        group.jumlah_anggota,
      ]
        .filter(Boolean)
        .join(" "));
      const searchableRecords = [
        groupText,
        ...rosterRows.map((row) => {
          const nimDigits = String(row[1] ?? "").replace(/\D/g, "");
          return normalizeSearchText(`${groupText} ${row.join(" ")} ${nimDigits}`);
        }),
      ];

      return searchTerms.length === 0 || searchableRecords.some((record) =>
        searchTerms.every((term) => record.includes(term)));
    });

  groupGrid.replaceChildren(
    ...matchingGroups.map(({ group, number }) => createGroupCard(group, number)),
  );
  groupGrid.removeAttribute("aria-busy");
  delete groupGrid.dataset.loading;
  resultCount.textContent = `${matchingGroups.length} dari ${groups.length} kelompok`;
  emptyState.hidden = matchingGroups.length !== 0;
}

function renderGroupSkeletons() {
  if (groupGrid.dataset.loading === "true") return;

  groupGrid.dataset.loading = "true";
  groupGrid.setAttribute("aria-busy", "true");
  groupGrid.replaceChildren(
    ...Array.from({ length: groups.length }, () => {
      const card = document.createElement("div");
      card.className = "group-skeleton";
      card.setAttribute("aria-hidden", "true");

      const number = document.createElement("span");
      number.className = "skeleton-block skeleton-number";

      const content = document.createElement("span");
      content.className = "skeleton-content";

      const title = document.createElement("span");
      title.className = "skeleton-block skeleton-title";

      const subtitle = document.createElement("span");
      subtitle.className = "skeleton-block skeleton-subtitle";
      content.append(title, subtitle);

      const arrow = document.createElement("span");
      arrow.className = "skeleton-block skeleton-arrow";
      card.append(number, content, arrow);
      return card;
    }),
  );
  resultCount.textContent = `Memuat ${groups.length} kelompok...`;
  emptyState.hidden = true;
}

function createGroupCard(group, number) {
  const button = document.createElement("button");
  button.className = "group-card";
  button.type = "button";
  button.setAttribute("aria-label", `Lihat detail ${displayName(group, number)}`);

  const numberBadge = document.createElement("span");
  numberBadge.className = "card-number";
  numberBadge.textContent = String(number).padStart(2, "0");

  const content = document.createElement("span");
  content.className = "card-content";

  const title = document.createElement("span");
  title.className = "card-title";
  title.textContent = displayName(group, number);

  const subtitle = document.createElement("span");
  subtitle.className = "card-subtitle";
  subtitle.textContent = group.jumlah_anggota > 0
    ? `${group.jumlah_anggota} anggota · ${group.lokasi || `Kelompok ${number}`}`
    : `KKN 51 UMPR · Kelompok ${number}`;

  const arrow = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  arrow.setAttribute("viewBox", "0 0 24 24");
  arrow.setAttribute("class", "card-arrow");
  arrow.setAttribute("aria-hidden", "true");
  const arrowPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
  arrowPath.setAttribute("d", "m9 18 6-6-6-6");
  arrow.append(arrowPath);

  content.append(title, subtitle);
  button.append(numberBadge, content, arrow);
  button.addEventListener("click", () => openGroupDialog(group, number));
  return button;
}

function openGroupDialog(group, number) {
  activeGroupNumber = number;
  updateGroupDialogDetails(group, number);

  spreadsheetFrame.title = `Spreadsheet asli ${displayName(group, number)}`;
  spreadsheetFrame.src = "about:blank";
  detailPanel.hidden = false;
  webViewPanel.hidden = true;
  nativeTableView.hidden = true;
  rawSheetView.hidden = true;
  dialog.classList.remove("is-viewing-sheet");
  document.body.classList.add("dialog-open");
  dialog.showModal();
}

function updateGroupDialogDetails(group, number) {
  const name = displayName(group, number);
  dialogGroupNumber.textContent = `Kelompok ${String(number).padStart(2, "0")}`;
  dialogTitle.textContent = name;
  dialogDescription.textContent = `Ringkasan data ${name} dari spreadsheet KKN 51 UMPR 2026.`;
  document.querySelector("#detail-dpl").textContent = availableValue(group.dpl);
  document.querySelector("#detail-members").textContent = group.jumlah_anggota > 0
    ? `${group.jumlah_anggota} orang`
    : "Belum ditambahkan";
  document.querySelector("#detail-location").textContent = availableValue(group.lokasi);
  document.querySelector("#detail-notes").textContent = availableValue(group.keterangan);

  previewImage.onerror = () => {
    previewImage.hidden = true;
    previewPlaceholder.hidden = false;
  };
  if (group.url_preview_thumbnail?.trim()) {
    previewImage.src = group.url_preview_thumbnail;
    previewImage.alt = `Pratinjau ${name}`;
    previewImage.hidden = false;
    previewPlaceholder.hidden = true;
  } else {
    previewImage.removeAttribute("src");
    previewImage.alt = "";
    previewImage.hidden = true;
    previewPlaceholder.hidden = false;
  }
}

function closeGroupDialog() {
  dialog.close();
}

function getSpreadsheetUrl(group, number) {
  const url = new URL(group.url_spreedsheet);
  if (url.protocol !== "https:") {
    throw new Error(`URL spreadsheet kelompok ${number} harus menggunakan HTTPS.`);
  }
  return url;
}

function openGroupViewer(mode) {
  const group = groups[activeGroupNumber - 1];
  const spreadsheetUrl = getSpreadsheetUrl(group, activeGroupNumber);
  detailPanel.hidden = true;
  webViewPanel.hidden = false;
  dialog.classList.add("is-viewing-sheet");

  if (mode === "native") {
    viewerTitle.textContent = `Daftar anggota · ${displayName(group, activeGroupNumber)}`;
    nativeTableView.hidden = false;
    rawSheetView.hidden = true;
    spreadsheetLoading.hidden = true;
    spreadsheetFrame.src = "about:blank";
    loadNativeTable(group, activeGroupNumber);
    return;
  }

  viewerTitle.textContent = `Spreadsheet asli · ${displayName(group, activeGroupNumber)}`;
  nativeTableView.hidden = true;
  rawSheetView.hidden = false;
  spreadsheetLoading.classList.remove("is-error");
  setLoadingStatus(spreadsheetLoading, "Memuat spreadsheet...", true);
  spreadsheetLoading.hidden = false;
  spreadsheetFrame.src = spreadsheetUrl.href;
}

async function loadNativeTable(group, number) {
  tableStatus.classList.remove("is-warning");
  membersTableHead.replaceChildren();
  membersTableBody.replaceChildren();

  try {
    let groupData = memberRowsByGroup.get(number);
    if (!groupData) {
      setLoadingStatus(tableStatus, "Memuat daftar anggota...", true);
      groupData = await fetchGroupData(group, number);
      Object.assign(group, groupData.metadata);
      memberRowsByGroup.set(number, groupData);
      updateGroupDialogDetails(group, number);
      renderGroups(searchInput.value);
    }

    renderMembersTable(groupData.roster);
    setLoadingStatus(
      tableStatus,
      `${groupData.roster.rows.length} anggota · ${displayName(group, number)}`,
      false,
    );
  } catch (error) {
    console.error(`Gagal memuat tabel anggota kelompok ${number}:`, error);
    tableStatus.classList.add("is-warning");
    setLoadingStatus(
      tableStatus,
      `Gagal memuat data anggota kelompok ${number}. ${error.message}`,
      false,
    );
  }
}

function renderMembersTable(roster) {
  const headerRow = document.createElement("tr");
  for (const header of roster.headers) {
    const cell = document.createElement("th");
    cell.scope = "col";
    cell.textContent = header;
    headerRow.append(cell);
  }
  membersTableHead.replaceChildren(headerRow);

  const rows = roster.rows.map((values) => {
    const row = document.createElement("tr");
    for (const value of values) {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    }
    return row;
  });
  membersTableBody.replaceChildren(...rows);
}

searchInput.addEventListener("input", (event) => {
  renderGroups(event.currentTarget.value);
});
closeDialogButton.addEventListener("click", closeGroupDialog);
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) closeGroupDialog();
});
dialog.addEventListener("close", () => {
  spreadsheetFrame.src = "about:blank";
  spreadsheetLoading.hidden = true;
  dialog.classList.remove("is-viewing-sheet");
  document.body.classList.remove("dialog-open");
});
spreadsheetFrame.addEventListener("load", () => {
  if (rawSheetView.hidden || !dialog.open) return;
  setLoadingStatus(spreadsheetLoading, "Spreadsheet berhasil dimuat.", false);
  spreadsheetLoading.hidden = true;
});
spreadsheetFrame.addEventListener("error", () => {
  if (rawSheetView.hidden || !dialog.open) return;
  spreadsheetLoading.classList.add("is-error");
  setLoadingStatus(
    spreadsheetLoading,
    "Spreadsheet gagal dimuat. Periksa koneksi lalu coba lagi.",
    false,
  );
});
openWebViewButton.addEventListener("click", () => {
  openGroupViewer("native");
});
openRawSheetButton.addEventListener("click", () => {
  openGroupViewer("raw");
});
document.querySelector("#back-to-details").addEventListener("click", () => {
  webViewPanel.hidden = true;
  detailPanel.hidden = false;
  nativeTableView.hidden = true;
  rawSheetView.hidden = true;
  spreadsheetLoading.hidden = true;
  dialog.classList.remove("is-viewing-sheet");
  spreadsheetFrame.src = "about:blank";
});

async function fetchGroupData(group, number) {
  const url = getSpreadsheetUrl(group, number);
  const gid = url.searchParams.get("gid");
  if (!gid) {
    throw new Error(`URL spreadsheet kelompok ${number} tidak memiliki gid.`);
  }

  const response = await fetch(url.href, { cache: "no-cache" });
  if (!response.ok) {
    throw new Error(`Spreadsheet kelompok ${number} merespons HTTP ${response.status}.`);
  }

  const sheetDocument = new DOMParser().parseFromString(await response.text(), "text/html");
  const summaryHeader = sheetDocument.getElementById(`${gid}R2`);
  const summary = summaryHeader?.closest("tr")?.querySelector("td[colspan]")?.textContent
    ?.replace(/\s+/g, " ")
    .trim();
  if (!summary) {
    throw new Error(`Ringkasan baris 3 kelompok ${number} tidak ditemukan di spreadsheet.`);
  }

  const parts = summary.split(/\s+[—–]\s+/);
  const titleMatch = parts.shift()?.match(/^(.*?)\s*\((\d+)\s+Mahasiswa\)\s*$/i);
  const dplPart = parts.find((part) => /^DPL:/i.test(part));
  const locationIndex = parts.findIndex((part) => /^Lokasi:/i.test(part));
  if (!titleMatch || !dplPart || locationIndex < 0) {
    throw new Error(`Format ringkasan kelompok ${number} tidak dikenali.`);
  }

  const dpl = dplPart
    .replace(/^DPL:\s*/i, "")
    .replace(/\s+\[[^\]]*\]\s*$/, "")
    .trim();
  const location = parts[locationIndex].replace(/^Lokasi:\s*/i, "").trim();
  if (!dpl || !location) {
    throw new Error(`DPL atau lokasi kelompok ${number} kosong di ringkasan spreadsheet.`);
  }

  return {
    metadata: {
      nama: titleMatch[1].trim(),
      jumlah_anggota: Number(titleMatch[2]),
      dpl,
      lokasi: location,
      keterangan: parts.slice(locationIndex + 1).join(" — ").trim(),
    },
    roster: parseRoster(sheetDocument, gid, number),
  };
}

function parseRoster(sheetDocument, gid, number) {
  const headerElement = sheetDocument.getElementById(`${gid}R3`);
  const headerRow = headerElement?.closest("tr");
  const headers = headerRow
    ? [...headerRow.querySelectorAll("td")].map((cell) => cell.textContent.trim())
    : [];
  const expectedHeaders = [
    "No",
    "NIM",
    "Nama Mahasiswa",
    "Program Studi (SIAKAD)",
    "Fakultas",
    "Angkatan",
  ];

  if (!headerRow || expectedHeaders.some((header, index) => headers[index] !== header)) {
    throw new Error(`Judul kolom anggota kelompok ${number} tidak ditemukan pada baris 4.`);
  }

  const rows = [];
  for (let row = headerRow.nextElementSibling; row; row = row.nextElementSibling) {
    const values = [...row.querySelectorAll("td")]
      .slice(0, expectedHeaders.length)
      .map((cell) => cell.textContent.replace(/\s+/g, " ").trim());
    if (/^\d+$/.test(values[0] ?? "") && values[2]) {
      rows.push(values);
    }
  }

  return { headers: expectedHeaders, rows };
}

async function syncGroupMetadata() {
  setLoadingStatus(dataStatus, "Memuat informasi terbaru dari 25 spreadsheet...", true);
  const results = await Promise.allSettled(
    groups.map((group, index) => fetchGroupData(group, index + 1)),
  );
  const failedGroups = [];

  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      Object.assign(groups[index], result.value.metadata);
      memberRowsByGroup.set(index + 1, result.value);
      return;
    }

    failedGroups.push(index + 1);
    console.error(`Gagal memuat data kelompok ${index + 1}:`, result.reason);
  });

  metadataLoading = false;
  renderGroups(searchInput.value);
  if (failedGroups.length > 0) {
    dataStatus.classList.add("is-warning");
    setLoadingStatus(
      dataStatus,
      `Data terbaru dimuat untuk ${groups.length - failedGroups.length} dari ${groups.length} kelompok. Gagal memuat: ${failedGroups.join(", ")}.`,
      false,
    );
    return;
  }

  dataStatus.classList.remove("is-warning");
  setLoadingStatus(dataStatus, "Informasi kelompok berhasil diperbarui dari spreadsheet.", false);
}

renderGroupSkeletons();
syncGroupMetadata();
