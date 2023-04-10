import * as THREE from 'three';
import { MOUSE_CONFIG, CURSOR_CONFIG } from './mouse-config';
import Loader from '../../../../core/loader';
import { CURSOR_MONITOR_TYPE } from './mouse-data';
import { NOTEBOOK_MOUNT_CONFIG } from '../notebook/notebook-config';

export default class Cursor extends THREE.Group {
  constructor(mouse, monitorScreen, notebookScreen) {
    super();

    this._mouse = mouse;
    this._monitorScreen = monitorScreen;
    this._notebookScreen = notebookScreen;

    this._view = null;
    this._monitorSize = null;
    this._notebookSize = null;
    this._mousePosition = null;
    this._currentMonitorData = null;
    this._previousMousePosition = new THREE.Vector2();

    this._cursorPosition = new THREE.Vector2();
    this._monitorType = CURSOR_MONITOR_TYPE.Monitor;

    this._init();
  }

  update(dt) {
    this._mousePosition = this._mouse.getCurrentPosition();
    const delta = this._mousePosition.clone().sub(this._previousMousePosition);

    const changeScreen = this._updateCursorPosition(delta);

    if (changeScreen) {
      this._updateCursorPosition(delta);
    }

    this._updateViewPosition(delta);

    this._previousMousePosition = this._mousePosition;
  }

  _updateCursorPosition(delta) {
    this._setCursorStartScreenPosition();
    this._cursorPosition.add(delta);
    const changeScreen = this._currentMonitorData[this._monitorType].checkPositionFunction();

    return changeScreen;
  }

  _checkPositionForMonitor() {
    const { cursorHalfWidth, cursorHalfHeight, sensitivity } = this._getCursorData();
    let changeScreen = false;

    const screenSize = this._currentMonitorData[this._monitorType].size;

    const topEdge = (screenSize.y * 0.5 - cursorHalfHeight) / sensitivity;
    const bottomEdge = (-screenSize.y * 0.5 + cursorHalfHeight) / sensitivity;
    const leftEdge = (-screenSize.x * 0.5 + cursorHalfWidth) / sensitivity;
    const rightEdge = (screenSize.x * 0.5 - cursorHalfWidth) / sensitivity;

    this._cursorPosition.y = THREE.MathUtils.clamp(this._cursorPosition.y, bottomEdge, topEdge);

    if (this._cursorPosition.x > rightEdge) {
      this._cursorPosition.x = rightEdge;
    }

    if (this._cursorPosition.x < leftEdge) {
      if (this._cursorPosition.y < CURSOR_CONFIG.monitorBottomOffsetToNotTransferCursor ) {
        this._monitorType = CURSOR_MONITOR_TYPE.Notebook;
        changeScreen = true;

        const notebookRightEdge = (this._currentMonitorData[this._monitorType].size.x * 0.5 - cursorHalfWidth) / sensitivity;
        this._cursorPosition.x = notebookRightEdge;
        this._cursorPosition.y -= 0.1;
      } else {
        this._cursorPosition.x = leftEdge;
      }
    }

    return changeScreen;
  }

  _checkPositionForNotebook() {
    const { cursorHalfWidth, cursorHalfHeight, sensitivity } = this._getCursorData();
    let changeScreen = false;

    const screenSize = this._currentMonitorData[this._monitorType].size;
    const bottomOffset = CURSOR_CONFIG.notebookScreenBottomOffset;

    const topEdge = (-bottomOffset - cursorHalfHeight) / sensitivity;
    const bottomEdge = (-bottomOffset - screenSize.y + cursorHalfHeight) / sensitivity;
    const leftEdge = (-screenSize.x * 0.5 + cursorHalfWidth) / sensitivity;
    const rightEdge = (screenSize.x * 0.5 - cursorHalfWidth) / sensitivity;

    this._cursorPosition.y = THREE.MathUtils.clamp(this._cursorPosition.y, bottomEdge, topEdge);

    if (this._cursorPosition.x < leftEdge) {
      this._cursorPosition.x = leftEdge;
    }

    if (this._cursorPosition.x > rightEdge) {
      this._monitorType = CURSOR_MONITOR_TYPE.Monitor;
      changeScreen = true;

      const monitorLeftEdge = (-this._currentMonitorData[this._monitorType].size.x * 0.5 + cursorHalfWidth) / sensitivity;
      this._cursorPosition.x = monitorLeftEdge;
      this._cursorPosition.y += 0.05;
    }

    return changeScreen;
  }

  _setCursorStartScreenPosition() {
    const screen = this._currentMonitorData[this._monitorType].screen;
    this._view.position.copy(screen.getWorldPosition(new THREE.Vector3()));

    if (this._monitorType === CURSOR_MONITOR_TYPE.Notebook) {
      const mountAngle = NOTEBOOK_MOUNT_CONFIG.startAngle;
      this._view.rotation.y = mountAngle * THREE.MathUtils.DEG2RAD;
    } else {
      this._view.rotation.copy(new THREE.Euler(0, 0, 0));
    }

    this._view.translateOnAxis(new THREE.Vector3(0, 0, 1), CURSOR_CONFIG.offsetFromScreen);
  }

  _updateViewPosition() {
    const sensitivity = CURSOR_CONFIG.sensitivity;
    this._view.translateOnAxis(new THREE.Vector3(1, 0, 0), this._cursorPosition.x * sensitivity);
    this._view.translateOnAxis(new THREE.Vector3(0, -1, 0), this._cursorPosition.y * sensitivity);
  }

  _getCursorData() {
    const cursorScale = CURSOR_CONFIG.view.scale;
    const sensitivity = CURSOR_CONFIG.sensitivity;

    const cursorHalfWidth = CURSOR_CONFIG.view.width * 0.5 * cursorScale;
    const cursorHalfHeight = CURSOR_CONFIG.view.height * 0.5 * cursorScale;

    return { cursorHalfWidth, cursorHalfHeight, sensitivity };
  }

  _init() {
    this._initCursorView();
    this._calculateSizes();
    this._initCurrentMonitorData();
  }

  _initCursorView() {
    const texture = Loader.assets['cursor'];

    const geometry = new THREE.PlaneGeometry(CURSOR_CONFIG.view.width, CURSOR_CONFIG.view.height);
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
    });
    const view = this._view = new THREE.Mesh(geometry, material);
    this.add(view);

    view.scale.set(CURSOR_CONFIG.view.scale, CURSOR_CONFIG.view.scale, 1);
  }

  _calculateSizes() {
    const monitorBoundingBox = new THREE.Box3().setFromObject(this._monitorScreen);
    this._monitorSize = monitorBoundingBox.getSize(new THREE.Vector3());

    const notebookBoundingBox = new THREE.Box3().setFromObject(this._notebookScreen);
    this._notebookSize = notebookBoundingBox.getSize(new THREE.Vector3());
    this._notebookSize.y = CURSOR_CONFIG.notebookScreenSizeY;
  }

  _initCurrentMonitorData() {
    this._currentMonitorData = {
      [CURSOR_MONITOR_TYPE.Monitor]: {
        screen: this._monitorScreen,
        size: this._monitorSize,
        checkPositionFunction: () => this._checkPositionForMonitor(),
      },
      [CURSOR_MONITOR_TYPE.Notebook]: {
        screen: this._notebookScreen,
        size: this._notebookSize,
        checkPositionFunction: () => this._checkPositionForNotebook(),
      },
    }
  }
}
