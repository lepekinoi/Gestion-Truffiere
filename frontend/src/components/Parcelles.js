                <div className="form-group">
                  <label>Surface (ha) *</label>
				  <input 
					type="number" 
					name="surface_ha" 
					value={formData.surface_ha} 
					onChange={handleInputChange} 
					required
					step="0.01" 
					placeholder="Ex: 1.5" 
				  />
                </div>