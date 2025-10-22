'use client';

import { useState, useEffect, Fragment } from 'react';
import { Parcel } from '@/lib/supabase';

interface DatabaseTableProps {
  parcels: Parcel[];
  onUpdate: () => void;
}

export default function DatabaseTable({ parcels, onUpdate }: DatabaseTableProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editData, setEditData] = useState<Partial<Parcel>>({});
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [draggedRow, setDraggedRow] = useState<number | null>(null);
  const [draggedOverRow, setDraggedOverRow] = useState<number | null>(null);
  const [localParcels, setLocalParcels] = useState<Parcel[]>(parcels);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newParcelData, setNewParcelData] = useState({
    sub_district: '',
    village: '',
    address: '',
    latitude: '',
    longitude: '',
  });
  
  // เก็บรายการตำบลและหมู่ที่มีอยู่แล้ว
  const [existingSubDistricts, setExistingSubDistricts] = useState<string[]>([]);
  const [existingVillages, setExistingVillages] = useState<string[]>([]);

  useEffect(() => {
    setLocalParcels(parcels);
    
    // ดึงรายการตำบลที่ไม่ซ้ำ
    const uniqueSubDistricts = [...new Set(parcels.map(p => p.sub_district))].sort();
    setExistingSubDistricts(uniqueSubDistricts);
  }, [parcels]);

  // อัปเดตรายการหมู่เมื่อเลือกตำบล
  useEffect(() => {
    if (newParcelData.sub_district) {
      const villages = parcels
        .filter(p => p.sub_district === newParcelData.sub_district)
        .map(p => p.village);
      const uniqueVillages = [...new Set(villages)].sort((a, b) => {
        const numA = parseInt(a.match(/\d+/)?.[0] || '0');
        const numB = parseInt(b.match(/\d+/)?.[0] || '0');
        return numA - numB;
      });
      setExistingVillages(uniqueVillages);
    } else {
      setExistingVillages([]);
    }
  }, [newParcelData.sub_district, parcels]);

  // Custom Confirm Dialog
  const showConfirm = (message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'custom-dialog-overlay';
      
      overlay.innerHTML = `
        <div class="custom-dialog">
          <div class="custom-dialog-header">
            <div class="custom-dialog-icon warning">
              <i class="fas fa-exclamation-triangle"></i>
            </div>
            <h3 class="custom-dialog-title">ยืนยันการดำเนินการ</h3>
            <p class="custom-dialog-message">${message}</p>
          </div>
          <div class="custom-dialog-footer">
            <button class="custom-dialog-btn custom-dialog-btn-cancel" data-action="cancel">
              <i class="fas fa-times mr-2"></i>ยกเลิก
            </button>
            <button class="custom-dialog-btn custom-dialog-btn-confirm" data-action="confirm">
              <i class="fas fa-check mr-2"></i>ยืนยัน
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);

      const handleClick = (e: Event) => {
        const target = e.target as HTMLElement;
        const action = target.closest('[data-action]')?.getAttribute('data-action');
        
        if (action) {
          overlay.remove();
          resolve(action === 'confirm');
        }
      };

      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.remove();
          resolve(false);
        }
      });

      overlay.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', handleClick);
      });
    });
  };

  const handleEdit = (parcel: Parcel) => {
    setEditingId(parcel.id!);
    setEditData({ ...parcel });
  };

  const handleSave = async () => {
    if (!editingId || !editData) return;

    try {
      const response = await fetch('/api/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sub_district: editData.sub_district,
          village: editData.village,
          address: editData.address,
          parcel_count: editData.parcel_count,
          on_truck: editData.on_truck,
          latitude: editData.latitude,
          longitude: editData.longitude,
        }),
      });

      if (response.ok) {
        setLocalParcels(localParcels.map(p => 
          p.id === editingId ? { ...p, ...editData } : p
        ));
        showToast('บันทึกสำเร็จ', 'success');
        setEditingId(null);
        setEditData({});
      } else {
        showToast('เกิดข้อผิดพลาด', 'error');
      }
    } catch (error) {
      showToast('ไม่สามารถบันทึกได้', 'error');
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditData({});
  };

  const handleDelete = async (parcel: Parcel) => {
    const confirmed = await showConfirm(`ต้องการลบ ${parcel.address} ใช่หรือไม่?`);
    if (!confirmed) return;

    try {
      const response = await fetch('/api/update', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sub_district: parcel.sub_district,
          village: parcel.village,
          address: parcel.address,
        }),
      });

      if (response.ok) {
        setLocalParcels(localParcels.filter(p => p.id !== parcel.id));
        showToast('ลบสำเร็จ', 'success');
      } else {
        showToast('เกิดข้อผิดพลาด', 'error');
      }
    } catch (error) {
      showToast('ไม่สามารถลบได้', 'error');
    }
  };

  const handleOpenAddModal = () => {
    setNewParcelData({
      sub_district: '',
      village: '',
      address: '',
      latitude: '',
      longitude: '',
    });
    setShowAddModal(true);
  };

  const handleCloseAddModal = () => {
    setShowAddModal(false);
  };

  const handleGetCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setNewParcelData({
            ...newParcelData,
            latitude: position.coords.latitude.toFixed(6),
            longitude: position.coords.longitude.toFixed(6),
          });
          showToast('ดึงพิกัดสำเร็จ', 'success');
        },
        (error) => {
          showToast('ไม่สามารถดึงตำแหน่งได้', 'error');
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }
  };

  const handleSubmitNewParcel = async () => {
    if (!newParcelData.sub_district || !newParcelData.village || !newParcelData.address) {
      showToast('กรุณากรอกข้อมูลให้ครบถ้วน', 'error');
      return;
    }

    try {
      const response = await fetch('/api/parcels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newParcelData,
          parcel_count: 0,
          on_truck: false,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setLocalParcels([...localParcels, data]);
        showToast('เพิ่มข้อมูลสำเร็จ', 'success');
        setShowAddModal(false);
      } else {
        showToast(data.error || 'เกิดข้อผิดพลาด', 'error');
      }
    } catch (error) {
      showToast('ไม่สามารถเพิ่มข้อมูลได้', 'error');
    }
  };

  const toggleSelectRow = (id: number) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedRows(newSelected);
  };

  const handleDeleteSelected = async () => {
    if (selectedRows.size === 0) {
      showToast('กรุณาเลือกแถวที่ต้องการลบ', 'error');
      return;
    }

    const confirmed = await showConfirm(`ต้องการลบ ${selectedRows.size} แถวที่เลือกใช่หรือไม่?`);
    if (!confirmed) return;

    const selectedParcels = localParcels.filter(p => selectedRows.has(p.id!));
    
    for (const parcel of selectedParcels) {
      await fetch('/api/update', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sub_district: parcel.sub_district,
          village: parcel.village,
          address: parcel.address,
        }),
      });
    }

    setLocalParcels(localParcels.filter(p => !selectedRows.has(p.id!)));
    showToast(`ลบ ${selectedRows.size} แถวสำเร็จ`, 'success');
    setSelectedRows(new Set());
  };

  const handleDragStart = (e: React.DragEvent, id: number) => {
    setDraggedRow(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, id: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDraggedOverRow(id);
  };

  const handleDragLeave = () => {
    setDraggedOverRow(null);
  };

  const handleDrop = async (e: React.DragEvent, targetId: number) => {
    e.preventDefault();
    
    if (draggedRow === null || draggedRow === targetId) {
      setDraggedRow(null);
      setDraggedOverRow(null);
      return;
    }

    const draggedIndex = localParcels.findIndex(p => p.id === draggedRow);
    const targetIndex = localParcels.findIndex(p => p.id === targetId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    const newParcels = [...localParcels];
    const [draggedItem] = newParcels.splice(draggedIndex, 1);
    newParcels.splice(targetIndex, 0, draggedItem);

    setLocalParcels(newParcels);

    const reorderedItems = newParcels.map((parcel, index) => ({
      id: parcel.id!,
      display_order: index
    }));

    fetch('/api/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: reorderedItems }),
    }).then(response => {
      if (response.ok) {
        showToast('เรียงลำดับสำเร็จ', 'success');
      } else {
        showToast('ไม่สามารถบันทึกลำดับได้', 'error');
        setLocalParcels(parcels);
      }
    }).catch(() => {
      showToast('เกิดข้อผิดพลาด', 'error');
      setLocalParcels(parcels);
    });

    setDraggedRow(null);
    setDraggedOverRow(null);
  };

  const handleDragEnd = () => {
    setDraggedRow(null);
    setDraggedOverRow(null);
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
      <span>${message}</span>
    `;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.animation = 'slideIn 0.3s ease-out reverse';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  };

  if (localParcels.length === 0) {
    return (
      <div className="empty-state">
        <i className="fas fa-inbox"></i>
        <h3>ไม่มีข้อมูล</h3>
        <p>ยังไม่มีรายการพัสดุในระบบ</p>
        <button onClick={handleOpenAddModal} className="btn-primary mt-4">
          <i className="fas fa-plus"></i> เพิ่มรายการแรก
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="table-container">
        <div className="toolbar">
          <button onClick={handleOpenAddModal} className="btn-primary">
            <i className="fas fa-plus"></i> เพิ่มแถวใหม่
          </button>
          {selectedRows.size > 0 && (
            <>
              <button onClick={handleDeleteSelected} className="btn-secondary">
                <i className="fas fa-trash"></i> ลบที่เลือก ({selectedRows.size})
              </button>
              <button onClick={() => setSelectedRows(new Set())} className="btn-secondary">
                <i className="fas fa-times"></i> ยกเลิกการเลือก
              </button>
            </>
          )}
        </div>

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '50px' }}>
                  <input
                    type="checkbox"
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedRows(new Set(localParcels.map(p => p.id!)));
                      } else {
                        setSelectedRows(new Set());
                      }
                    }}
                    checked={selectedRows.size === localParcels.length && localParcels.length > 0}
                  />
                </th>
                <th style={{ width: '40px' }}>
                  <i className="fas fa-grip-vertical"></i>
                </th>
                <th>ตำบล</th>
                <th>หมู่</th>
                <th>ที่อยู่</th>
                <th style={{ width: '100px' }}>จำนวน</th>
                <th style={{ width: '100px' }}>สถานะ</th>
                <th>Latitude</th>
                <th>Longitude</th>
                <th style={{ width: '180px' }}>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {localParcels.map((parcel, index) => (
                <Fragment key={parcel.id}>
                  <tr
                    className={`
                      ${selectedRows.has(parcel.id!) ? 'selected' : ''}
                      ${draggedRow === parcel.id ? 'dragging' : ''}
                      ${draggedOverRow === parcel.id ? 'drag-over' : ''}
                    `}
                    draggable
                    onDragStart={(e) => handleDragStart(e, parcel.id!)}
                    onDragOver={(e) => handleDragOver(e, parcel.id!)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, parcel.id!)}
                    onDragEnd={handleDragEnd}
                  >
                    <td>
                      <div className="flex justify-center">
                        <input
                          type="checkbox"
                          checked={selectedRows.has(parcel.id!)}
                          onChange={() => toggleSelectRow(parcel.id!)}
                        />
                      </div>
                    </td>

                    <td>
                      <div className="flex justify-center">
                        <div className="action-btn drag-handle">
                          <i className="fas fa-grip-vertical"></i>
                        </div>
                      </div>
                    </td>

                    <td>
                      {editingId === parcel.id ? (
                        <input
                          type="text"
                          className="table-cell-input"
                          value={editData.sub_district || ''}
                          onChange={(e) => setEditData({ ...editData, sub_district: e.target.value })}
                        />
                      ) : (
                        <span className="px-4">{parcel.sub_district}</span>
                      )}
                    </td>

                    <td>
                      {editingId === parcel.id ? (
                        <input
                          type="text"
                          className="table-cell-input"
                          value={editData.village || ''}
                          onChange={(e) => setEditData({ ...editData, village: e.target.value })}
                        />
                      ) : (
                        <span className="px-4">{parcel.village}</span>
                      )}
                    </td>

                    <td>
                      {editingId === parcel.id ? (
                        <input
                          type="text"
                          className="table-cell-input"
                          value={editData.address || ''}
                          onChange={(e) => setEditData({ ...editData, address: e.target.value })}
                        />
                      ) : (
                        <span className="px-4">{parcel.address}</span>
                      )}
                    </td>

                    <td>
                      {editingId === parcel.id ? (
                        <input
                          type="number"
                          className="table-cell-input"
                          value={editData.parcel_count || 0}
                          onChange={(e) => setEditData({ ...editData, parcel_count: parseInt(e.target.value) || 0 })}
                          min="0"
                        />
                      ) : (
                        <span className="px-4">{parcel.parcel_count}</span>
                      )}
                    </td>

                    <td>
                      {editingId === parcel.id ? (
                        <div className="flex justify-center">
                          <input
                            type="checkbox"
                            checked={editData.on_truck || false}
                            onChange={(e) => setEditData({ ...editData, on_truck: e.target.checked })}
                          />
                        </div>
                      ) : (
                        <div className="flex justify-center">
                          {parcel.on_truck ? (
                            <span className="badge badge-primary">
                              <i className="fas fa-truck-fast"></i> บนรถ
                            </span>
                          ) : (
                            <span className="badge badge-secondary">
                              <i className="fas fa-clock"></i> รอ
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    <td>
                      {editingId === parcel.id ? (
                        <input
                          type="text"
                          className="table-cell-input"
                          value={editData.latitude || ''}
                          onChange={(e) => setEditData({ ...editData, latitude: e.target.value })}
                          placeholder="13.756345"
                        />
                      ) : (
                        <span className="px-4 text-text-secondary text-sm">
                          {parcel.latitude || '-'}
                        </span>
                      )}
                    </td>

                    <td>
                      {editingId === parcel.id ? (
                        <input
                          type="text"
                          className="table-cell-input"
                          value={editData.longitude || ''}
                          onChange={(e) => setEditData({ ...editData, longitude: e.target.value })}
                          placeholder="100.501800"
                        />
                      ) : (
                        <span className="px-4 text-text-secondary text-sm">
                          {parcel.longitude || '-'}
                        </span>
                      )}
                    </td>

                    <td>
                      {editingId === parcel.id ? (
                        <div className="table-actions">
                          <button onClick={handleSave} className="action-btn save" title="บันทึก">
                            <i className="fas fa-check"></i>
                          </button>
                          <button onClick={handleCancel} className="action-btn cancel" title="ยกเลิก">
                            <i className="fas fa-times"></i>
                          </button>
                        </div>
                      ) : (
                        <div className="table-actions">
                          <button onClick={() => handleEdit(parcel)} className="action-btn edit" title="แก้ไข">
                            <i className="fas fa-edit"></i>
                          </button>
                          <button onClick={() => handleDelete(parcel)} className="action-btn delete" title="ลบ">
                            <i className="fas fa-trash"></i>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>

        <div className="toolbar border-t border-divider">
          <p className="text-text-secondary text-sm">
            แสดง {localParcels.length} รายการ
            {selectedRows.size > 0 && ` · เลือก ${selectedRows.size} แถว`}
          </p>
        </div>
      </div>

      {/* Add Modal with Datalist/Combobox */}
      {showAddModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && handleCloseAddModal()}>
          <div className="modal-content">
            <div className="modal-header">
              <h2 className="modal-title">
                <i className="fas fa-plus-circle mr-2"></i>
                เพิ่มที่อยู่ใหม่
              </h2>
              <button onClick={handleCloseAddModal} className="modal-close">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">
                  <i className="fas fa-city"></i>ตำบล
                </label>
                <input
                  type="text"
                  className="input-field"
                  list="subdistrict-list"
                  placeholder="พิมพ์หรือเลือกตำบล"
                  value={newParcelData.sub_district}
                  onChange={(e) => setNewParcelData({ ...newParcelData, sub_district: e.target.value, village: '' })}
                />
                <datalist id="subdistrict-list">
                  {existingSubDistricts.map(sub => (
                    <option key={sub} value={sub} />
                  ))}
                </datalist>
                <p className="text-xs text-text-secondary mt-1">
                  <i className="fas fa-info-circle mr-1"></i>
                  เลือกจากรายการหรือพิมพ์ใหม่
                </p>
              </div>

              <div className="form-group">
                <label className="form-label">
                  <i className="fas fa-house-user"></i>หมู่
                </label>
                <input
                  type="text"
                  className="input-field"
                  list="village-list"
                  placeholder="พิมพ์หรือเลือกหมู่"
                  value={newParcelData.village}
                  onChange={(e) => setNewParcelData({ ...newParcelData, village: e.target.value })}
                  disabled={!newParcelData.sub_district}
                />
                <datalist id="village-list">
                  {existingVillages.map(village => (
                    <option key={village} value={village} />
                  ))}
                </datalist>
                <p className="text-xs text-text-secondary mt-1">
                  <i className="fas fa-info-circle mr-1"></i>
                  {newParcelData.sub_district 
                    ? 'เลือกจากรายการหรือพิมพ์ใหม่' 
                    : 'เลือกตำบลก่อน'}
                </p>
              </div>

              <div className="form-group">
                <label className="form-label">
                  <i className="fas fa-map-pin"></i>ที่อยู่
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="เช่น 50/4"
                  value={newParcelData.address}
                  onChange={(e) => setNewParcelData({ ...newParcelData, address: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="form-label">
                    <i className="fas fa-location-dot"></i>Latitude
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="13.756345"
                    value={newParcelData.latitude}
                    onChange={(e) => setNewParcelData({ ...newParcelData, latitude: e.target.value })}
                  />
                </div>
                <div>
                  <label className="form-label">
                    <i className="fas fa-location-dot"></i>Longitude
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="100.501800"
                    value={newParcelData.longitude}
                    onChange={(e) => setNewParcelData({ ...newParcelData, longitude: e.target.value })}
                  />
                </div>
              </div>

              <button onClick={handleGetCurrentLocation} className="btn-secondary w-full">
                <i className="fas fa-location-crosshairs mr-2"></i>
                ใช้ตำแหน่งปัจจุบัน
              </button>
            </div>
            <div className="modal-footer">
              <button onClick={handleCloseAddModal} className="btn-secondary">
                <i className="fas fa-times mr-2"></i>ยกเลิก
              </button>
              <button onClick={handleSubmitNewParcel} className="btn-primary">
                <i className="fas fa-check mr-2"></i>บันทึก
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
