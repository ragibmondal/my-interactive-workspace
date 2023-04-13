import * as THREE from 'three';
import { TWEEN } from '/node_modules/three/examples/jsm/libs/tween.module.min.js';
import Delayed from '../../../../core/helpers/delayed-call';
import RoomObjectAbstract from '../room-object.abstract';
import { ROOM_CONFIG } from '../../data/room-config';
import { LAPTOP_MOUNT_PARTS, LAPTOP_PARTS, LAPTOP_PART_TYPE, LAPTOP_POSITION_STATE, LAPTOP_STATE } from './laptop-data';
import { LAPTOP_CONFIG, LAPTOP_MOUNT_CONFIG } from './laptop-config';
import { HELP_ARROW_TYPE } from '../../help-arrows/help-arrows-config';
import HelpArrows from '../../help-arrows/help-arrows';

export default class Laptop extends RoomObjectAbstract {
  constructor(meshesGroup, roomObjectType, audioListener) {
    super(meshesGroup, roomObjectType, audioListener);

    this._laptopTopGroup = null;
    this._armWithLaptopGroup = null;
    this._laptopTween = null;
    this._helpArrows = null;

    this._isMountSelected = false;
    this._plane = new THREE.Plane();
    this._pNormal = new THREE.Vector3(0, 1, 0);

    this._previousArmMountAngle = 0;

    this._init();
  }

  showWithAnimation(delay) {
    super.showWithAnimation();

    this._debugMenu.disable();
    this._setPositionForShowAnimation();

    Delayed.call(delay, () => {
      const fallDownTime = ROOM_CONFIG.startAnimation.objectFallDownTime;

      const laptopStand = this._parts[LAPTOP_PART_TYPE.LaptopStand];
      const laptopMount = this._parts[LAPTOP_PART_TYPE.LaptopMount];
      const laptopArmMountBase = this._parts[LAPTOP_PART_TYPE.LaptopArmMountBase];
      const laptopArmMountArm01 = this._parts[LAPTOP_PART_TYPE.LaptopArmMountArm01];
      const laptopArmMountArm02 = this._parts[LAPTOP_PART_TYPE.LaptopArmMountArm02];
      const armMountParts = [laptopStand, laptopMount, laptopArmMountBase, laptopArmMountArm01, laptopArmMountArm02]

      const laptopKeyboard = this._parts[LAPTOP_PART_TYPE.LaptopKeyboard];
      const laptopMonitor = this._parts[LAPTOP_PART_TYPE.LaptopMonitor];
      const laptopScreen = this._parts[LAPTOP_PART_TYPE.LaptopScreen];
      const laptopParts = [laptopKeyboard, laptopMonitor, laptopScreen]

      armMountParts.forEach((part) => {
        new TWEEN.Tween(part.position)
          .to({ y: part.userData.startPosition.y }, fallDownTime)
          .easing(ROOM_CONFIG.startAnimation.objectFallDownEasing)
          .start();
      });

      laptopParts.forEach((part) => {
        new TWEEN.Tween(part.position)
          .to({ y: part.userData.startPosition.y }, fallDownTime)
          .easing(ROOM_CONFIG.startAnimation.objectFallDownEasing)
          .delay(fallDownTime * 0.5)
          .start();
      });

      Delayed.call(fallDownTime * 0.5 + fallDownTime, () => {
        this._debugMenu.enable();
        this._onShowAnimationComplete();
      });
    });
  }

  onClick(intersect) {
    if (!this._isInputEnabled) {
      return;
    }

    const roomObject = intersect.object;
    const partType = roomObject.userData.partType;

    if (LAPTOP_PARTS.includes(partType)) {
      this._laptopInteract();
    } else {
      this._standInteract(intersect);
    }
  }

  onPointerMove(raycaster) {
    if (!this._isMountSelected) {
      return;
    }

    const laptopMount = this._parts[LAPTOP_PART_TYPE.LaptopStand];
    const planeIntersect = new THREE.Vector3();
    raycaster.ray.intersectPlane(this._plane, planeIntersect);

    const angle = Math.atan2(planeIntersect.z - laptopMount.position.z, planeIntersect.x - laptopMount.position.x);
    const angleDelta = angle - this._previousArmMountAngle;

    if (Math.abs(angleDelta) < 0.1) {
      LAPTOP_MOUNT_CONFIG.angle += angleDelta * THREE.MathUtils.RAD2DEG;
    }

    const leftEdge = LAPTOP_MOUNT_CONFIG.leftEdgeAngle;
    const rightEdge = LAPTOP_MOUNT_CONFIG.rightEdgeAngle;

    LAPTOP_MOUNT_CONFIG.angle = THREE.MathUtils.clamp(LAPTOP_MOUNT_CONFIG.angle, leftEdge, rightEdge);
    this._onMountAngleChanged();
    this._debugMenu.updateMountAngle();

    this._previousArmMountAngle = angle;
  }

  onPointerOver(mesh) {
    if (this._isPointerOver) {
      return;
    }

    super.onPointerOver();

    const partType = mesh.userData.partType;

    if (LAPTOP_MOUNT_PARTS.includes(partType)) {
      this._helpArrows.show();
    }
  }

  onPointerOut() {
    if (!this._isPointerOver) {
      return;
    }

    super.onPointerOut();

    this._helpArrows.hide();
  }

  getMeshesForOutline(mesh) {
    const partType = mesh.userData.partType;

    if (LAPTOP_MOUNT_PARTS.includes(partType)) {
      return this._getLaptopMountParts();
    }

    if (LAPTOP_PARTS.includes(partType)) {
      return this._getLaptopParts();
    }
  }

  getScreen() {
    return this._parts[LAPTOP_PART_TYPE.LaptopScreen];
  }

  _laptopInteract() {
    this._isMountSelected = false;

    if (LAPTOP_CONFIG.state === LAPTOP_STATE.Moving) {
      this._updateLaptopPositionType();
    }

    this._debugMenu.updateLaptopButtonTitle();

    LAPTOP_CONFIG.state = LAPTOP_STATE.Moving;
    this._debugMenu.updateTopPanelState();
    this._stopLaptopTween();

    const maxAngle = LAPTOP_CONFIG.positionType === LAPTOP_POSITION_STATE.Opened ? 0 : LAPTOP_CONFIG.maxOpenAngle;

    const remainingRotationAngle = maxAngle - (-this._laptopTopGroup.rotation.x * THREE.MathUtils.RAD2DEG);
    const time = Math.abs(remainingRotationAngle) / LAPTOP_CONFIG.rotationSpeed * 100;

    this._laptopTween = new TWEEN.Tween(this._laptopTopGroup.rotation)
      .to({ x: -maxAngle * THREE.MathUtils.DEG2RAD }, time)
      .easing(TWEEN.Easing.Sinusoidal.Out)
      .start()
      .onUpdate(() => {
        LAPTOP_CONFIG.angle = -this._laptopTopGroup.rotation.x * THREE.MathUtils.RAD2DEG;
      })
      .onComplete(() => {
        this._updateLaptopPositionType();

        if (LAPTOP_CONFIG.positionType === LAPTOP_POSITION_STATE.Closed) {
          this.events.post('onLaptopClosed');
        }

        LAPTOP_CONFIG.state = LAPTOP_STATE.Idle;
        this._debugMenu.updateTopPanelState();
      });
  }

  _updateLaptopPositionType() {
    LAPTOP_CONFIG.positionType = LAPTOP_CONFIG.positionType === LAPTOP_POSITION_STATE.Opened ? LAPTOP_POSITION_STATE.Closed : LAPTOP_POSITION_STATE.Opened;
  }

  _stopLaptopTween() {
    if (this._laptopTween) {
      this._laptopTween.stop();
    }
  }

  _standInteract(intersect) {
    this._isMountSelected = true;

    const pIntersect = new THREE.Vector3().copy(intersect.point);
    this._plane.setFromNormalAndCoplanarPoint(this._pNormal, pIntersect);
  }

  _init() {
    this._initParts();
    this._addMaterials();
    this._addPartsToScene();
    this._initVideo();
    this._initHelpArrows();
    this._initDebugMenu();
    this._initSignals();
  }

  _initSignals() {
    this._debugMenu.events.on('openLaptop', () => this._laptopInteract());
    this._debugMenu.events.on('mountAngleChanged', () => this._onMountAngleChanged());
  }

  _onMountAngleChanged() {
    this._armWithLaptopGroup.rotation.y = LAPTOP_MOUNT_CONFIG.angle * THREE.MathUtils.DEG2RAD;
  }

  _addPartsToScene() {
    super._addPartsToScene();

    this._initArmWithLaptopGroup();
    this._initLaptopTopGroup();
  }

  _initArmWithLaptopGroup() {
    const armWithLaptopGroup = this._armWithLaptopGroup = new THREE.Group();
    this.add(armWithLaptopGroup);

    const armMountArm02 = this._parts[LAPTOP_PART_TYPE.LaptopArmMountArm02];
    const laptopMount = this._parts[LAPTOP_PART_TYPE.LaptopMount];
    const laptopStand = this._parts[LAPTOP_PART_TYPE.LaptopStand];
    const laptopKeyboard = this._parts[LAPTOP_PART_TYPE.LaptopKeyboard];

    armWithLaptopGroup.add(armMountArm02, laptopMount, laptopStand, laptopKeyboard);

    const startPosition = armMountArm02.userData.startPosition.clone();

    armWithLaptopGroup.position.copy(startPosition);
    laptopMount.position.sub(startPosition);
    laptopStand.position.sub(startPosition);
    laptopKeyboard.position.sub(startPosition);

    armMountArm02.position.set(0, 0, 0);

    armWithLaptopGroup.rotation.y = LAPTOP_MOUNT_CONFIG.startAngle * THREE.MathUtils.DEG2RAD;
    LAPTOP_MOUNT_CONFIG.angle = LAPTOP_MOUNT_CONFIG.startAngle;
  }

  _initLaptopTopGroup() {
    const laptopTopGroup = this._laptopTopGroup = new THREE.Group();
    this._armWithLaptopGroup.add(laptopTopGroup);

    const laptopMonitor = this._parts[LAPTOP_PART_TYPE.LaptopMonitor];
    const laptopScreen = this._parts[LAPTOP_PART_TYPE.LaptopScreen];
    const armMountArm02 = this._parts[LAPTOP_PART_TYPE.LaptopArmMountArm02];

    const startPosition = armMountArm02.userData.startPosition.clone();

    laptopTopGroup.add(laptopMonitor, laptopScreen);

    laptopTopGroup.rotation.x = -LAPTOP_CONFIG.maxOpenAngle * THREE.MathUtils.DEG2RAD;
    laptopTopGroup.position.copy(laptopMonitor.position.clone());

    laptopMonitor.position.set(0, 0, 0);
    laptopMonitor.rotation.set(0, 0, 0);
    laptopScreen.position.set(0, 0, 0);
    laptopScreen.rotation.set(0, 0, 0);

    laptopTopGroup.position.sub(startPosition);

    LAPTOP_CONFIG.angle = LAPTOP_CONFIG.maxOpenAngle;
  }

  _initVideo() {
    // const videoElement = document.createElement('video');
    // videoElement.muted = true;
    // videoElement.loop = true;
    // videoElement.controls = true;
    // videoElement.playsInline = true;
    // videoElement.autoplay = true;
    // videoElement.src = '/static/video/games_showreel.mp4';
    // videoElement.play();

    // const texture = new THREE.VideoTexture(videoElement);
    // texture.encoding = THREE.sRGBEncoding;

    // const laptopScreen = this._parts[LAPTOP_PART_TYPE.LaptopScreen];
    // laptopScreen.material.color = new THREE.Color(0xffffff);
    // laptopScreen.material.map = texture;
  }

  _initHelpArrows() {
    const helpArrowsTypes = [HELP_ARROW_TYPE.LaptopMountLeft, HELP_ARROW_TYPE.LaptopMountRight];
    const helpArrows = this._helpArrows = new HelpArrows(helpArrowsTypes);
    this._armWithLaptopGroup.add(helpArrows);

    const stand = this._parts[LAPTOP_PART_TYPE.LaptopStand];
    helpArrows.position.copy(stand.position.clone());
    helpArrows.position.z += 0.7;
    helpArrows.position.y -= 0.27;
  }

  _getLaptopParts() {
    const parts = [];

    LAPTOP_PARTS.forEach((partName) => {
      parts.push(this._parts[partName]);
    });

    return parts;
  }

  _getLaptopMountParts() {
    const parts = [];

    LAPTOP_MOUNT_PARTS.forEach((partName) => {
      parts.push(this._parts[partName]);
    });

    return parts;
  }
}
