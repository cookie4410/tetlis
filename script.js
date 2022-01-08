"use strict";

// キャンバス情報取得
const CANVAS = document.getElementById("tet_field");
const CONTEXT = CANVAS.getContext("2d");

// テトリミノ関連定数
const MINOS = [
  // 各ミノのブロック座標
  [0, 0, 0, 0, 0, 0, 0, 0], // none
  [0, 1, 1, 0, 1, 1, 1, 2], // T
  [0, 1, 0, 2, 1, 0, 1, 1], // S
  [0, 0, 0, 1, 1, 1, 1, 2], // Z
  [0, 2, 1, 0, 1, 1, 1, 2], // L
  [0, 0, 1, 0, 1, 1, 1, 2], // J
  [0, 1, 0, 2, 1, 1, 1, 2], // O
  [1, 0, 1, 1, 1, 2, 1, 3], // I
];
const BC_LIST = [
  // 各ミノの色コード
  "#777", //ghost
  "#6b2ee6", //T
  "#3dcc3d", //S
  "#e61717", //Z
  "#e65c17", //L
  "#3333ff", //J
  "#e6e645", //O
  "#4de7ff", //I
  "#999", //wall
];
const BLOCK_SIZE = 20; // ブロックの縦横幅

// フィールド関連定数
const FIELD_ROW = 23; // フィールドの行数（20行 + 壁 + 画面外）
const FIELD_COL = 12; // フィールドの列数（10行 + 壁）
const FIELD_TEMPLATE = [8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 8]; // フィールドのテンプレート

// キャンバス関連定数
const CANVAS_W = BLOCK_SIZE * FIELD_COL * 2; // キャンバスの横幅を計算
const CANVAS_H = BLOCK_SIZE * (FIELD_ROW - 2) + BLOCK_SIZE / 2; // キャンバスの縦幅を計算
const MARGIN = (BLOCK_SIZE * FIELD_COL) / 2; // ゲーム時のマージンを計算

// 各種初期値
const DEFAULT_SPEED = 1000; // デフォルトのゲームスピード
class InitializeKeys {
  // デフォルトのキー配置
  constructor() {
    this.move_L = "ArrowLeft";
    this.move_R = "ArrowRight";
    this.softDrop = "ArrowDown";
    this.hardDrop = "ArrowUp";
    this.rotate_L = "a";
    this.rotate_R = "d";
    this.hold = "Shift";
  }
}
class InitializeStats {
  // デフォルトの成績ステータス
  constructor() {
    this.score = 0;
    this.level = "-";
    this.lines = 0;
  }
}

// グローバル変数定義
let startTime; // ループ開始時間
let frameCount = 0; // ループ時のフレームカウント
let field = []; // フィールドマップデータ
let situation = "TITLE"; // ゲームモード
let selectPos = 0; // メニュー時選択箇所
let confirmPos = 1; // 確認時選択箇所
let configPromptMode = false; // キーコンフィグ入力待機
let mino_x = 0; // 現在ミノのX座標
let mino_y = 0; // 現在ミノのY座標
let currentMino; // 現在ミノのマップデータ
let minoLength; // 現在ミノの長さ
let minoNum; // 現在ミノの番号
let minoBag = []; // ミノバッグ
let direction; // 現在ミノの方角
let hold = 0; // ホールド中のミノ番号
let useHold = false; // ホールド使用済判定
let oldKeys = {}; // キーコンフィグ時の待避所
let oldKey = ""; // キーコンフィグ時の待避所
let keys = new InitializeKeys(); // 現在のキーコンフィグ
let stats = new InitializeStats(); // 現在の成績
let gameSpeed = DEFAULT_SPEED; // 現在のゲームスピード
let trickMes; // 加点メッセージ文
let pauseTime; // ポーズした時間
let useSpin = false; // 直近の操作が回転か判定
let useTSpin = false; // TSpin判定
let useTSpinMini = false; //TSpinミニ判定
let srsPattern = 0; // SRSパターン
let allCookies = getCookies(); // クッキーの連想配列

// キャンバス描画サイズ指定
CANVAS.setAttribute("width", CANVAS_W);
CANVAS.setAttribute("height", CANVAS_H);

// フィールドマップの二次元配列を生成
function buildFieldMap() {
  let newField = field;
  while (newField.length < FIELD_ROW - 1) {
    newField.unshift(FIELD_TEMPLATE.slice());
  }
  newField.push([8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8]);
  return newField;
}

// ミノデータから二次元配列を作成
function buildMinoMap(num, rotate) {
  let count = 0;
  let minoMap = [];
  let minoData = MINOS[num];
  let len;
  // I型ミノ分岐
  if (num === 7 && rotate === true) {
    while (minoMap.length < 4) {
      let defaultRow = [0, 0, 0, 0];
      minoMap.unshift(defaultRow.slice());
    }
    return minoMap;
  } else if (rotate === true) {
    num = 0;
  }
  if (num != 7) {
    len = 3;
  } else {
    len = 4;
  }
  for (let i = 0; i < len; i++) {
    minoMap.push([]);
    for (let j = 0; j < len; j++) {
      if (minoData[count] === i && minoData[count + 1] === j) {
        minoMap[i].push(num);
        count += 2;
      } else {
        minoMap[i].push(0);
      }
    }
  }
  return minoMap;
}

// ブロックを描画
function drawBlock(x, y, blockNum) {
  let blockColor = BC_LIST[blockNum];
  CONTEXT.beginPath();
  CONTEXT.fillStyle = blockColor;
  CONTEXT.rect(x + MARGIN, y - BLOCK_SIZE * 1.5, BLOCK_SIZE, BLOCK_SIZE);
  CONTEXT.fill();
  CONTEXT.strokeStyle = "#222";
  CONTEXT.lineWidth = "1";
  CONTEXT.stroke();
}

// テトリミノを描画
function drawMino() {
  let length = calcMinoLength(minoNum);
  for (let i = 0; i < length; i++) {
    for (let j = 0; j < length; j++) {
      if (currentMino[i][j]) {
        drawBlock(
          (mino_x + j) * BLOCK_SIZE,
          (mino_y + i) * BLOCK_SIZE,
          currentMino[i][j]
        );
      }
    }
  }
}

// フィールドを描画
function drawField() {
  CONTEXT.clearRect(0, 0, CANVAS.width, CANVAS.height);
  CONTEXT.beginPath();
  CONTEXT.fillStyle = "#222";
  CONTEXT.fillRect(0, 0, CANVAS.width, CANVAS.height);
  for (let i = 1; i < FIELD_ROW; i++) {
    for (let j = 0; j < FIELD_COL; j++) {
      if (field[i][j]) {
        drawBlock(j * BLOCK_SIZE, i * BLOCK_SIZE, field[i][j]);
      }
    }
  }
}

// ゴーストを描画
function drawGhost() {
  let ghost_y = 0;
  for (let i = 1; checkMove(0, i); i++) {
    ghost_y = i;
  }
  for (let i = 0; i < minoLength; i++) {
    for (let j = 0; j < minoLength; j++) {
      if (currentMino[i][j]) {
        drawBlock(
          (mino_x + j) * BLOCK_SIZE,
          (ghost_y + mino_y + i) * BLOCK_SIZE,
          0
        );
      }
    }
  }
}

// 判定ラインを描画
function drawLine() {
  CONTEXT.beginPath();
  CONTEXT.moveTo(MARGIN, BLOCK_SIZE / 2);
  CONTEXT.lineTo(FIELD_COL * BLOCK_SIZE + MARGIN, BLOCK_SIZE / 2);
  CONTEXT.strokeStyle = "#888";
  CONTEXT.lineWidth = 0.5;
  CONTEXT.stroke();
}

// 塗りつぶし文字を描画
function drawFillText(t, x, y, size, color, weight) {
  CONTEXT.font = `${weight} ${size}px "Press Start 2P"`;
  CONTEXT.fillStyle = color;
  let w = CONTEXT.measureText(t).width;
  x = CANVAS_W / 2 - w / 2 + x;
  y = CANVAS_H / 2 + y;
  CONTEXT.fillText(t, x, y);
}

// 枠線文字を描画
function drawStrokeText(t, x, y, size, color, weight) {
  CONTEXT.font = `${weight} ${size}px "Press Start 2P"`;
  CONTEXT.lineWidth = 0.1;
  CONTEXT.strokeStyle = color;
  let w = CONTEXT.measureText(t).width;
  x = CANVAS_W / 2 - w / 2 + x;
  y = CANVAS_H / 2 + y;
  CONTEXT.strokeText(t, x, y);
}

// 各種窓枠を描画
function drawWindows() {
  let x = 10 + MARGIN * 3;
  let y = 10;
  CONTEXT.lineWidth = 1;
  CONTEXT.strokeStyle = "#ddd";
  drawRadialRect(x, y, BLOCK_SIZE * 5, BLOCK_SIZE * 5, 10, "#ddd");
  drawRadialRect(10, y, BLOCK_SIZE * 5, BLOCK_SIZE * 5, 10, "#ddd");
  CONTEXT.font = 'bold 15px "Press Start 2P"';
  CONTEXT.fillStyle = "#ddd";
  CONTEXT.fillText("NEXT", x + 10, 35);
  CONTEXT.fillText("HOLD", 20, 35);
  for (let i = 0; i <= 4; i++) {
    drawRadialRect(
      x,
      BLOCK_SIZE * (5 + i * 3) + y * 2,
      BLOCK_SIZE * 4,
      BLOCK_SIZE * 2.4,
      10,
      "#ddd"
    );
  }
}

// 角丸四角形を描画
function drawRadialRect(x, y, w, h, r, color) {
  CONTEXT.beginPath();
  CONTEXT.lineWidth = 1;
  CONTEXT.strokeStyle = color;
  CONTEXT.moveTo(x, y + r);
  CONTEXT.arc(x + r, y + h - r, r, Math.PI, Math.PI * 0.5, true);
  CONTEXT.arc(x + w - r, y + h - r, r, Math.PI * 0.5, 0, 1);
  CONTEXT.arc(x + w - r, y + r, r, 0, Math.PI * 1.5, 1);
  CONTEXT.arc(x + r, y + r, r, Math.PI * 1.5, Math.PI, 1);
  CONTEXT.closePath();
  CONTEXT.stroke();
}

// 次のミノを描画
function drawNextMino() {
  if (minoBag.length < 7) {
    minoBag = minoBag.concat(genBag());
  }
  let nextMino = buildMinoMap(minoBag[0]);
  let length = calcMinoLength(minoBag[0]);
  let x = 0;
  let y = 0;
  for (let i = 0; i < length; i++) {
    for (let j = 0; j < length; j++) {
      if (nextMino[i][j]) {
        if (minoBag[0] <= 5) {
          x = BLOCK_SIZE / 2;
        } else if (minoBag[0] === 7) {
          y = -1 * (BLOCK_SIZE / 2);
        }
        drawBlock(
          x + (13 + j) * BLOCK_SIZE,
          y + (4 + i) * BLOCK_SIZE,
          nextMino[i][j]
        );
      }
    }
  }
}

// 2～5個先のミノを描画
function drawProspect() {
  if (minoBag.length < 7) {
    minoBag = minoBag.concat(genBag());
  }
  for (let i = 0; i < 5; i++) {
    drawSmallMino(i);
  }
}

// ホールドを描画
function drawHold() {
  if (hold != 0 && useHold === false) {
    drawHoldMino(hold);
  } else if (hold != 0) {
    drawHoldMino(0);
  }
}

// ホールドミノを描画
function drawHoldMino(color) {
  let holdMino = buildMinoMap(hold);
  let length = calcMinoLength(hold);
  let x = 0;
  let y = 0;
  for (let i = 0; i < length; i++) {
    for (let j = 0; j < length; j++) {
      if (holdMino[i][j]) {
        if (hold <= 5) {
          x = BLOCK_SIZE / 2;
        } else if (hold === 7) {
          y = -1 * (BLOCK_SIZE / 2);
        }
        drawBlock(x + (-5 + j) * BLOCK_SIZE, y + (4 + i) * BLOCK_SIZE, color);
      }
    }
  }
}

// ブロックを描画（サイズ小）
function drawSmallBlock(x, y, blockNum) {
  let blockColor = BC_LIST[blockNum];
  let blockSize = BLOCK_SIZE * 0.8;
  CONTEXT.beginPath();
  CONTEXT.fillStyle = blockColor;
  CONTEXT.rect(x + MARGIN, y - BLOCK_SIZE * 1.5, blockSize, blockSize);
  CONTEXT.fill();
  CONTEXT.strokeStyle = "#222";
  CONTEXT.lineWidth = "1";
  CONTEXT.stroke();
}

// ミノを描画（サイズ小）
function drawSmallMino(num) {
  let targetNum = minoBag[num + 1];
  let targetMino = buildMinoMap(targetNum);
  let length = calcMinoLength(targetNum);
  let x = 0;
  let y = num * BLOCK_SIZE * 3;
  for (let i = 0; i < length; i++) {
    for (let j = 0; j < length; j++) {
      if (targetMino[i][j]) {
        if (targetNum <= 5) {
          x = (BLOCK_SIZE / 2) * 0.8;
        } else if (targetNum === 7) {
          y = -1 * ((BLOCK_SIZE / 2) * 0.8) + num * BLOCK_SIZE * 3;
        }
        drawSmallBlock(
          x + 12 * BLOCK_SIZE + (j + 1.1) * BLOCK_SIZE * 0.8,
          y + BLOCK_SIZE * 7.5 + (i + 0.5) * BLOCK_SIZE * 0.8,
          targetMino[i][j]
        );
      }
    }
  }
}

// 成績を描画
function drawStatus() {
  drawRadialRect(10, 20 + BLOCK_SIZE * 5, BLOCK_SIZE * 5, 150, 10, "#ddd");
  CONTEXT.font = '10px "Press Start 2P"';
  CONTEXT.fillStyle = "#ddd";
  const X = 20;
  const Y = 40 + BLOCK_SIZE * 5;
  let ny;
  for (let p in stats) {
    switch (p) {
      case "level":
        ny = Y;
        break;
      case "lines":
        ny = Y + 50;
        break;
      case "score":
        ny = Y + 100;
        break;
    }
    CONTEXT.textAlign = "end";
    CONTEXT.fillText(stats[p], BLOCK_SIZE * 5, ny + 20);
    CONTEXT.textAlign = "start";
    CONTEXT.fillText(p, X, ny);
  }
}

function drawTrickMes() {
  let t = "T-Spin\nMini\nDouble";
  t = ""; //test
  let tlist = t.split("\n");
  for (let i = 0; i < tlist.length; i++) {
    drawFillText(tlist[i], -180, 90 + i * 18, 14, "#ddd", "normal");
  }
}

// ゲーム画面をまとめて描画
function drawAll() {
  drawField();
  drawGhost();
  drawMino();
  drawLine();
  drawWindows();
  drawNextMino();
  drawProspect();
  drawHold();
  drawStatus();
  drawTrickMes();
}

// ミノバッグを生成
function genBag() {
  let newBag = new Array(7);
  let serialNum = 1;
  for (let i = 0; i < newBag.length; i++) {
    newBag[i] = serialNum;
    serialNum++;
  }
  for (let i = newBag.length; i > 1; i--) {
    let target = Math.floor(Math.random() * i);
    [newBag[target], newBag[i - 1]] = [newBag[i - 1], newBag[target]];
  }
  return newBag;
}

// ミノの長さを計算
function calcMinoLength(num) {
  let lenth;
  switch (num) {
    case 1:
    case 2:
    case 3:
    case 4:
    case 5:
    case 6:
      length = 3;
      break;
    case 7:
      length = 4;
      break;
  }
  return length;
}

// 新規ミノ出現
function spawnMino() {
  if (minoBag.length === 0) {
    minoBag = genBag();
  }
  minoNum = minoBag.shift();
  currentMino = buildMinoMap(minoNum);
  minoLength = calcMinoLength(minoNum);
  mino_x = 4;
  mino_y = 0;
  direction = 0;
}

// 衝突判定
function checkMove(x, y, newMino) {
  if (newMino === undefined) {
    newMino = currentMino;
  }
  let new_x;
  let new_y;
  for (let i = 0; i < minoLength; i++) {
    for (let j = 0; j < minoLength; j++) {
      if (newMino[i][j]) {
        new_x = mino_x + x + j;
        new_y = mino_y + y + i;
        if (
          new_x < 0 ||
          new_x >= FIELD_COL ||
          new_y >= FIELD_ROW ||
          field[new_y][new_x]
        ) {
          return false;
        }
      }
    }
  }
  return true;
}

// 回転処理
function rotateMino(key) {
  let rotated = false;
  let newMinoMap = buildMinoMap(minoNum, true);
  for (let i = 0; i < minoLength; i++) {
    for (let j = 0; j < minoLength; j++) {
      if (key === keys.rotate_L) {
        if (currentMino[j][minoLength - 1 - i]) {
          newMinoMap[i][j] = currentMino[j][minoLength - 1 - i];
        }
      } else {
        if (currentMino[minoLength - 1 - j][i]) {
          newMinoMap[i][j] = currentMino[minoLength - 1 - j][i];
        }
      }
    }
  }
  if (checkMove(0, 0, newMinoMap)) {
    currentMino = newMinoMap;
    rotated = true;
  } else {
    rotated = srs(key, newMinoMap);
  }
  return rotated;
}

// TSpin成否チェック
function checkTSpin() {
  let count = 0;
  const CHECK_POINT = [0, 0, 0, 2, 2, 0, 2, 2];
  let checkMini = false;
  let pointStats = "";
  for (let i = 0; i < 8; i += 2) {
    if (field[mino_y + CHECK_POINT[i]][mino_x + CHECK_POINT[i + 1]]) {
      count++;
      pointStats += "1";
    } else {
      pointStats += "0";
    }
  }
  if (count === 3) {
    let target;
    switch (direction) {
      case 0:
        target = ["1011", "0111"];
        break;
      case 1:
        target = ["1011", "1110"];
        break;
      case 2:
        target = ["1101", "1110"];
        break;
      case 3:
        target = ["0111", "1101"];
        break;
    }
    if (target.includes(pointStats)) {
      checkMini = true;
    }
  }
  if (count >= 3 && useSpin) {
    useTSpin = true;
    if (checkMini && srsPattern != 4) {
      useTSpinMini = true;
    }
  }
  srsPattern = 0;
}

// スーパーローテーション処理
function srs(key, newMino) {
  let srsPosition = [];
  srsPattern = 0;
  if (key === "a") {
    if (minoNum === 7) {
      switch (direction) {
        case 0:
          srsPosition = [-1, 0, 2, 0, -1, -2, 2, 1];
          break;
        case 1:
          srsPosition = [2, 0, -1, 0, 2, -1, -1, 2];
          break;
        case 2:
          srsPosition = [1, 0, -2, 0, 1, 2, -2, -1];
          break;
        case 3:
          srsPosition = [1, 0, -2, 0, -2, 1, 1, -2];
          break;
      }
    } else {
      switch (direction) {
        case 0:
          srsPosition = [1, 0, 1, -1, 0, 2, 1, 2];
          break;
        case 1:
          srsPosition = [1, 0, 1, 1, 0, -2, 1, -2];
          break;
        case 2:
          srsPosition = [-1, 0, -1, -1, 0, 2, -1, 2];
          break;
        case 3:
          srsPosition = [-1, 0, -1, 1, 0, -2, -1, -2];
          break;
      }
    }
  } else {
    if (minoNum === 7) {
      switch (direction) {
        case 0:
          srsPosition = [-2, 0, 1, 0, -2, 1, 1, -2];
          break;
        case 1:
          srsPosition = [-1, 0, 2, 0, -1, -2, 2, 1];
          break;
        case 2:
          srsPosition = [2, 0, -1, 0, 2, -1, -1, 2];
          break;
        case 3:
          srsPosition = [-2, 0, 1, 0, 1, 2, -2, -1];
          break;
      }
    } else {
      switch (direction) {
        case 0:
          srsPosition = [-1, 0, -1, -1, 0, 2, -1, 2];
          break;
        case 1:
          srsPosition = [1, 0, 1, 1, 0, -2, 1, -2];
          break;
        case 2:
          srsPosition = [1, 0, 1, -1, 0, 2, 1, 2];
          break;
        case 3:
          srsPosition = [-1, 0, -1, 1, 0, -2, -1, -2];
          break;
      }
    }
  }
  for (let i = 0; i <= 6; i += 2) {
    srsPattern++;
    if (checkMove(srsPosition[i], srsPosition[i + 1], newMino)) {
      currentMino = newMino;
      mino_x += srsPosition[i];
      mino_y += srsPosition[i + 1];
      return true;
    }
  }
  return false;
}

// ミノをフィールドに固定
function fixMino() {
  for (let i = 0; i < minoLength; i++) {
    for (let j = 0; j < minoLength; j++) {
      if (currentMino[i][j]) {
        field[mino_y + i][mino_x + j] = minoNum;
      }
    }
  }
  useHold = false;
  spawnMino();
}

// 自動落下
function dropMino() {
  if (checkMove(0, 1)) {
    useSpin = false;
    mino_y++;
  } else {
    checkLineOver();
    fixMino();
    checkCollision();
  }
}

// ハードドロップ
function hardDrop() {
  let ghost_y = 0;
  for (let i = 1; checkMove(0, i); i++) {
    ghost_y = i;
  }
  mino_y += ghost_y;
  checkLineOver();
  fixMino();
  checkCollision();
}

// ホールド入れ替え
function swapHold() {
  if (useHold === false) {
    if (hold === 0) {
      hold = minoNum;
      spawnMino();
    } else {
      [hold, minoNum] = [minoNum, hold];
      currentMino = buildMinoMap(minoNum);
      minoLength = calcMinoLength(minoNum);
      mino_x = 4;
      mino_y = 0;
      direction = 0;
    }
    useHold = true;
  }
}

// ライン完成判定
function checkLine() {
  let alignLine = [];
  for (let i = 1; i < FIELD_ROW - 1; i++) {
    for (let j = 1; j < FIELD_COL - 1; j++) {
      if (field[i][j]) {
        if (j === field[i].length - 2) {
          alignLine.push(i);
        }
      } else {
        break;
      }
    }
  }
  if (alignLine.length === 0) {
    return;
  } else {
    return alignLine;
  }
}

// 加点メッセージを生成
function genTrickMes() {
  if (useTSpin) {
    trickMes += "T-Spin";
  }
  if (useTSpinMini) {
    trickMes += "\nMini";
  }
  useTSpin = false;
  useTSpinMini = false;
}

// 得点を計算して加算
function calcPoint(alignLine) {
  let t = "";
  switch (alignLine.length) {
    case 1:
      t += "SINGLE";
      stats.score += 100;
      break;
    case 2:
      t += "DOUBLE";
      stats.score += 300;
      break;
    case 3:
      t += "TRIPLE";
      stats.score += 500;
      break;
    case 4:
      t += "TETRiS";
      stats.score += 800;
      break;
  }
}

// ライン消去
function clearLine(alignLine) {
  for (let line of alignLine) {
    field.splice(line, 1);
    field.unshift(FIELD_TEMPLATE.slice());
    stats.lines++;
  }
}

// ライン超えゲームオーバー判定
function checkLineOver() {
  let lineOverCount = 0;
  for (let i = 0; i < minoLength; i++) {
    for (let j = 0; j < minoLength; j++) {
      if (currentMino[i][j]) {
        if (mino_y + i <= 1) {
          lineOverCount++;
          if (lineOverCount === 4) {
            situation = "GAME_OVER";
            return;
          }
        }
      }
    }
  }
}

// 干渉ゲームオーバー判定
function checkCollision() {
  for (let i = 0; i < minoLength; i++) {
    for (let j = 0; j < minoLength; j++) {
      if (currentMino[i][j]) {
        if (field[mino_y + i][mino_x + j]) {
          situation = "GAME_OVER";
          return;
        }
      }
    }
  }
}

// 各種変数の初期化
function initialize(mode) {
  situation = mode;
  selectPos = 0;
  configPromptMode = false;
  startTime = performance.now();
  field = [];
  field = buildFieldMap();
  minoBag = [];
  frameCount = 0;
  mino_x = 0;
  mino_y = 0;
  hold = 0;
  useHold = false;
  gameSpeed = DEFAULT_SPEED;
  stats = new InitializeStats();
}

// タイトル画面描画
function drawTitle() {
  CONTEXT.clearRect(0, 0, CANVAS.width, CANVAS.height);
  CONTEXT.beginPath();
  CONTEXT.fillStyle = "#222";
  CONTEXT.fillRect(0, 0, CANVAS.width, CANVAS.height);
  drawStrokeText("TETLiS", 0, -60, 70, "#ddd", "bold");
  drawFillText("NORMAL GAME", 0, 0, 20, "#ddd", "bold");
  drawFillText("KEY CONFiG", 0, 30, 20, "#ddd", "bold");
  drawFillText("Press ENTER to start!", 0, 100, 20, "#ddd", "bold");
  drawFillText("->", -140, selectPos * 30, 20, "#ddd", "bold");
}

// ポーズメニュー描画
function drawPause() {
  CONTEXT.fillStyle = "rgba(34, 34, 34, 0.8)";
  CONTEXT.fillRect(0, 0, CANVAS.width, CANVAS.height);
  drawFillText("PAUSE", 0, -60, 70, "#222", "bold");
  drawStrokeText("PAUSE", 0, -60, 70, "#ddd", "bold");
  drawFillText("RETURN", 0, 0, 20, "#ddd", "bold");
  drawFillText("RESTART", 0, 30, 20, "#ddd", "bold");
  drawFillText("TiTLE", 0, 60, 20, "#ddd", "bold");
  drawFillText("->", -100, selectPos * 30, 20, "#ddd", "bold");
}

// ゲームオーバー表示描画
function drawGameOver() {
  CONTEXT.fillStyle = "rgba(34, 34, 34, 0.8)";
  CONTEXT.fillRect(0, 0, CANVAS.width, CANVAS.height);
  drawFillText("GAME", 0, -20, "80", "#222", "bold");
  drawStrokeText("GAME", 0, -20, "80", "#ddd", "bold");
  drawFillText("OVER", 0, 70, "80", "#222", "bold");
  drawStrokeText("OVER", 0, 70, "80", "#ddd", "bold");
  drawFillText("Press SPACE", 0, 140, "30", "#222", "normal");
  drawStrokeText("Press SPACE", 0, 140, "30", "#ddd", "bold");
}

// クッキーを連想配列で取得
function getCookies() {
  let result = [];
  if (document.cookie != "") {
    const TMP = document.cookie.split("; ");
    for (let i = 0; i < TMP.length; i++) {
      let data = TMP[i].split("=");
      result[data[0]] = decodeURIComponent(data[1]);
    }
  }
  return result;
}

// クッキーからキーコンフィグ状態を反映
function setKeysByCookie() {
  for (let p in keys) {
    if (allCookies[p] != undefined) {
      keys[p] = allCookies[p];
    }
  }
}

// キーコンフィグ描画
function drawConfig() {
  CONTEXT.clearRect(0, 0, CANVAS.width, CANVAS.height);
  CONTEXT.beginPath();
  CONTEXT.fillStyle = "#222";
  CONTEXT.fillRect(0, 0, CANVAS.width, CANVAS.height);
  drawFillText("KEY CONFiG", 0, -150, 40, "#ddd", "bold");
  const Y = CANVAS_H / 2 - 100;
  let ny;
  let t;
  let arrow_y;
  let key;
  for (let p in keys) {
    let key = keys[p];
    switch (key) {
      case "ArrowUp":
        key = "↑";
        break;
      case "ArrowDown":
        key = "↓";
        break;
      case "ArrowLeft":
        key = "<-";
        break;
      case "ArrowRight":
        key = "->";
        break;
      case " ":
        key = "Space";
        break;
    }
    switch (p) {
      case "move_L":
        ny = Y;
        t = `Move Left    : ${key}`;
        break;
      case "move_R":
        ny = Y + 30;
        t = `Move Right   : ${key}`;
        break;
      case "softDrop":
        ny = Y + 60;
        t = `Soft Drop    : ${key}`;
        break;
      case "hardDrop":
        ny = Y + 90;
        t = `Hard Drop    : ${key}`;
        break;
      case "rotate_L":
        ny = Y + 120;
        t = `Rotate Left  : ${key}`;
        break;
      case "rotate_R":
        ny = Y + 150;
        t = `Rotate Right : ${key}`;
        break;
      case "hold":
        ny = Y + 180;
        t = `Hold         : ${key}`;
        break;
    }
    if (selectPos >= 7) {
      arrow_y = selectPos * 30 - 70;
    } else {
      arrow_y = selectPos * 30 - 100;
    }
    if (configPromptMode) {
      key = "_";
      switch (selectPos) {
        case 0:
          oldKey = oldKeys.move_L;
          keys.move_L = key;
          break;
        case 1:
          oldKey = oldKeys.move_R;
          keys.move_R = key;
          break;
        case 2:
          oldKey = oldKeys.softDrop;
          keys.softDrop = key;
          break;
        case 3:
          oldKey = oldKeys.hardDrop;
          keys.hardDrop = key;
          break;
        case 4:
          oldKey = oldKeys.rotate_L;
          keys.rotate_L = key;
          break;
        case 5:
          oldKey = oldKeys.rotate_R;
          keys.rotate_R = key;
          break;
        case 6:
          oldKey = oldKeys.hold;
          keys.hold = key;
          break;
      }
    }
    CONTEXT.font = `normal 18px "Press Start 2P"`;
    CONTEXT.fillStyle = "#ddd";
    CONTEXT.fillText(t, 80, ny);
  }
  CONTEXT.fillText("Default", 80, Y + 270);
  CONTEXT.fillText("Back to Title", 80, Y + 240);
  drawFillText("->", -185, arrow_y, 20, "#ddd", "bold");
  drawFillText("SELECT: Enter / CANCEL: Esc", 0, 210, 14, "#ddd", "normal");
}

// キーコンフィグ変更
function changeKey(key) {
  if (key === "Enter" || key === "Tab") {
    drawConfig();
    drawFillText("CAN'T USE !", 0, 110, 20, "#ddd", "bold");
    return;
  } else if (Object.values(keys).includes(key)) {
    drawConfig();
    drawFillText("ALREADY USED !", 0, 110, 20, "#ddd", "bold");
    return;
  } else if (key === "Escape") {
    key = oldKey;
  }
  switch (selectPos) {
    case 0:
      keys.move_L = key;
      document.cookie =
        "move_L=" + encodeURIComponent(key) + ";max-age=315360000";
      break;
    case 1:
      keys.move_R = key;
      document.cookie =
        "move_R=" + encodeURIComponent(key) + ";max-age=315360000";
      break;
    case 2:
      keys.softDrop = key;
      document.cookie =
        "softDrop=" + encodeURIComponent(key) + ";max-age=315360000";
      break;
    case 3:
      keys.hardDrop = key;
      document.cookie =
        "hardDrop=" + encodeURIComponent(key) + ";max-age=315360000";
      break;
    case 4:
      keys.rotate_L = key;
      document.cookie =
        "rotate_L=" + encodeURIComponent(key) + ";max-age=315360000";
      break;
    case 5:
      keys.rotate_R = key;
      document.cookie =
        "rotate_R=" + encodeURIComponent(key) + ";max-age=315360000";
      break;
    case 6:
      keys.hold = key;
      document.cookie =
        "hold=" + encodeURIComponent(key) + ";max-age=315360000";
      break;
  }
  configPromptMode = !configPromptMode;
  drawConfig();
}

// コンフィグ確認画面描画
function drawConfigConfirm() {
  let w = 300;
  let h = 100;
  CONTEXT.fillStyle = "#222";
  CONTEXT.lineWidth = 1;
  CONTEXT.rect(CANVAS_W / 2 - w / 2, CANVAS_H / 2 - h / 2, w, h);
  CONTEXT.fill();
  CONTEXT.stroke();
  drawFillText("Are you sure?", 0, -10, 20, "#ddd", "bold");
  drawFillText("yes   no", 0, 30, 20, "#ddd", "bold");
  if (confirmPos === 0) {
    drawFillText("[    ]", -50, 30, 20, "#ddd", "bold");
  } else {
    drawFillText("[    ]", 60, 30, 20, "#ddd", "bold");
  }
}

// スクショボタン
document.getElementById("download").onclick = (event) => {
  let canvas = document.getElementById("tet_field");

  let link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = "tetris.png";
  link.click();
};

// キーボードイベント
document.onkeydown = function (e) {
  switch (situation) {
    case "GAME": // ノーマルゲーム時
      switch (e.key) {
        case keys.move_L: // 左移動(←)
          if (checkMove(-1, 0)) {
            mino_x--;
            useSpin = false;
          }
          break;
        case keys.move_R: // 右移動(→)
          if (checkMove(1, 0)) {
            mino_x++;
            useSpin = false;
          }
          break;
        case keys.softDrop: // 下移動(↓)
          if (checkMove(0, 1)) {
            mino_y++;
            useSpin = false;
          }
          break;
        case keys.hardDrop: // ハードドロップ(↑)
          hardDrop();
          break;
        case keys.rotate_L: // 左回転(a)
          if (minoNum != 6) {
            let rotated = rotateMino(e.key);
            if (rotated) {
              direction -= 1;
              if (direction < 0) {
                direction += 4;
              }
              useSpin = true;
            }
            if (minoNum === 1) {
              checkTSpin();
            }
          }
          break;
        case keys.rotate_R: // 右回転(d)
          if (minoNum != 6) {
            let rotated = rotateMino(e.key);
            if (rotated) {
              direction += 1;
              direction %= 4;
              useSpin = true;
            }
            if (minoNum === 1) {
              checkTSpin();
            }
            break;
          }
        case keys.hold:
          swapHold();
          break;
        case "Escape":
          situation = "PAUSE";
          selectPos = 0;
      }
      drawAll();
      break;
    case "PAUSE":
      switch (e.key) {
        case "ArrowUp":
          selectPos--;
          break;
        case "ArrowDown":
          selectPos++;
          break;
        case "Enter":
          switch (selectPos) {
            case 0:
              situation = "GAME";
              startTime += performance.now() - pauseTime;
              mainLoop();
              return;
            case 1:
              initialize("GAME");
              spawnMino();
              drawAll();
              mainLoop();
              return;
            case 2:
              initialize("TITLE");
              drawTitle();
              return;
          }
          break;
        case "Escape":
          situation = "GAME";
          startTime += performance.now() - pauseTime;
          mainLoop();
          return;
      }
      if (selectPos < 0) {
        selectPos += 3;
      }
      selectPos %= 3;
      drawAll();
      drawPause();
      break;
    case "GAME_OVER": // ゲームオーバー時
      if (e.key === " ") {
        initialize("TITLE");
        drawTitle();
      }
      break;
    case "TITLE": // タイトル画面時
      switch (e.key) {
        case "ArrowUp":
          selectPos--;
          break;
        case "ArrowDown":
          selectPos++;
          break;
        case "Enter":
          if (selectPos === 0) {
            initialize("GAME");
            spawnMino();
            drawAll();
            mainLoop();
            return;
          } else if (selectPos === 1) {
            initialize("CONFIG");
            drawConfig();
            return;
          }
          break;
      }
      if (selectPos < 0) {
        selectPos += 2;
      }
      selectPos %= 2;
      drawTitle();
      break;
    case "CONFIG": // コンフィグ時
      if (!configPromptMode) {
        switch (e.key) {
          case "ArrowUp":
            selectPos--;
            break;
          case "ArrowDown":
            selectPos++;
            break;
          case "Enter":
            if (selectPos === 7 || selectPos === 8) {
              situation = "CONFIG_CONFIRM";
              drawConfigConfirm();
              return;
            } else {
              oldKeys = JSON.parse(JSON.stringify(keys));
              configPromptMode = !configPromptMode;
              drawConfig();
            }
            break;
          case "Escape":
            initialize("TITLE");
            drawTitle();
            return;
        }
        if (selectPos < 0) {
          selectPos += 9;
        }
        selectPos %= 9;
        drawConfig();
        break;
      } else {
        changeKey(e.key);
      }
      break;
    case "CONFIG_CONFIRM": // コンフィグ確認画面時
      switch (e.key) {
        case "ArrowLeft":
          confirmPos--;
          break;
        case "ArrowRight":
          confirmPos++;
          break;
        case "Enter":
          if (confirmPos === 1) {
            situation = "CONFIG";
            drawConfig();
            confirmPos = 1;
            return;
          }
          switch (selectPos) {
            case 7:
              initialize("TITLE");
              drawTitle();
              confirmPos = 1;
              return;
            case 8:
              situation = "CONFIG";
              keys = new InitializeKeys();
              for (let p in keys) {
                document.cookie = p + "=; max-age=0";
              }
              drawConfig();
              confirmPos = 1;
              return;
          }
          break;
        case "Escape":
          situation = "CONFIG";
          drawConfig();
          confirmPos = 1;
          return;
      }
      if (confirmPos < 0) {
        confirmPos += 2;
      }
      confirmPos %= 2;
      drawConfig();
      drawConfigConfirm();
      break;
  }
};

// ゲーム本編メインループ
function mainLoop() {
  let nowTime = performance.now();
  let nowFrame = (nowTime - startTime) / gameSpeed;
  switch (situation) {
    case "GAME":
      if (nowFrame > frameCount) {
        let c = 0;
        while (nowFrame > frameCount) {
          frameCount++;
          let alignLine = checkLine();
          if (alignLine != undefined) {
            calcPoint(alignLine);
            clearLine(alignLine);
          } else {
            dropMino();
          }
          if (++c >= 4) {
            break;
          }
        }
      }
      drawAll();
      requestAnimationFrame(mainLoop);
      break;
    case "GAME_OVER":
      drawGameOver();
      cancelAnimationFrame(mainLoop);
      break;
    case "PAUSE":
      cancelAnimationFrame(mainLoop);
      pauseTime = performance.now();
      drawPause();
  }
}

// 画面読み込み時の処理
window.onload = function () {
  startTime = performance.now();
  setKeysByCookie();
  window.addEventListener("keydown", keydownfunc, true);
};

var keydownfunc = function (e) {
  var code = e.keyCode;
  switch (code) {
    case 37: // ←
    case 38: // ↑
    case 39: // →
    case 40: // ↓
    case 32: // Space
    case 9: // Tab
      e.preventDefault();
  }
};

// GoogleFont読み込み完了後の処理
WebFont.load({
  custom: {
    families: ["Press Start 2P"],
  },
  active: function () {
    drawTitle();
  },
  inactive: function () {
    drawTitle();
  },
});
