import Materials from "../../../../core/materials";
import RoomInactiveObjectAbstract from "../room-inactive-object-abstract";

export default class Picture extends RoomInactiveObjectAbstract {
  constructor(roomScene, roomObjectType) {
    super(roomScene, roomObjectType);

    this._addMaterials();
  }

  _addMaterials() {
    const material = Materials.getMaterial(Materials.type.bakedSmallObjects);
    this._mesh.material = material;
  }
}
